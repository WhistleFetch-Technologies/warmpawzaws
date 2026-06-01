package com.warmpawz.delivery.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.warmpawz.delivery.config.PidgeProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * Builds Pidge create-order JSON from the compact Warmpawz-style body
 * (mirrors {@code buildPidgeOrderPayloadFromSimplified} in {@code pidge-logistics.ts}).
 */
@Component
@RequiredArgsConstructor
public class PidgeOrderPayloadBuilder {

	private final ObjectMapper objectMapper;
	private final PidgeProperties pidgeProperties;

	public ObjectNode buildFromSimplified(JsonNode input, BrandDefaults defaults) {
		return buildFromSimplified(input, defaults, shouldOmitBrand(input));
	}

	/**
	 * @param omitBrand when true, the outgoing payload has no {@code brand} key (store/vendor Pidge accounts).
	 */
	public ObjectNode buildFromSimplified(JsonNode input, BrandDefaults defaults, boolean omitBrand) {
		String sourceOrderId = text(input, "sourceOrderId", "source_order_id", "orderId");
		sourceOrderId = sourceOrderId == null ? "" : sourceOrderId.trim();
		if (sourceOrderId.isEmpty()) {
			throw new IllegalArgumentException("sourceOrderId or orderId is required");
		}

		JsonNode senderRaw = firstObject(input, "sender", "pickup", "senderDetail");
		JsonNode receiverRaw = firstObject(input, "receiver", "delivery", "receiverDetail", "customer_detail", "customerDetail");
		ObjectNode senderDetail = toReceiverSenderDetail(senderRaw, defaults.defaultCountry());
		ObjectNode receiverDetail = toReceiverSenderDetail(receiverRaw, defaults.defaultCountry());

		JsonNode pocRaw = firstObject(input, "poc", "poc_detail");
		if (pocRaw == null || pocRaw.isNull()) {
			pocRaw = senderRaw;
		}
		ObjectNode pocDetail = objectMapper.createObjectNode();
		pocDetail.put("name", text(pocRaw, "name", null) != null ? text(pocRaw, "name", null) : text(senderRaw, "name", null));
		String pocMobile = text(pocRaw, "mobile", "phone");
		if (pocMobile == null) pocMobile = text(senderRaw, "mobile", "phone");
		pocDetail.put("mobile", pocMobile != null ? pocMobile : "");
		String pocEmail = text(pocRaw, "email", null);
		if (pocEmail == null) pocEmail = text(senderRaw, "email", null);
		pocDetail.put("email", pocEmail != null ? pocEmail : "");

		ArrayNode products = buildProducts(input.path("items"));
		if (products.isEmpty()) {
			products = buildProducts(input.path("products"));
		}
		double billAmount = number(input, "billAmount", "bill_amount", "subTotal", "orderValue");
		double codAmount = number(input, "codAmount", "cod_amount");

		ArrayNode packagesFromItems = packagesFromProducts(products);
		if (packagesFromItems.isEmpty()) {
			packagesFromItems = defaultPackages(input);
		}

		coerceAddressForPidge((ObjectNode) senderDetail.get("address"));
		coerceAddressForPidge((ObjectNode) receiverDetail.get("address"));
		String receiverEmail = textOrEmpty(receiverDetail.get("email"));
		String senderEmail = textOrEmpty(senderDetail.get("email"));
		String sharedFallback = firstNonEmpty(senderEmail, receiverEmail, "delivery-placeholder@warmpawz.app");
		ensureNonEmptyEmail(senderDetail, sharedFallback);
		ensureNonEmptyEmail(receiverDetail, firstNonEmpty(receiverEmail, sharedFallback));
		ensureNonEmptyEmail(pocDetail, firstNonEmpty(
				textOrEmpty(pocDetail.get("email")),
				textOrEmpty(senderDetail.get("email")),
				textOrEmpty(receiverDetail.get("email")),
				"delivery-placeholder@warmpawz.app"));

		ObjectNode trip = objectMapper.createObjectNode();
		trip.set("receiver_detail", receiverDetail);
		trip.set("packages", packagesFromItems);
		trip.put("source_order_id", sourceOrderId);
		trip.put("reference_id", text(input, "referenceId", "reference_id") != null
				? text(input, "referenceId", "reference_id")
				: sourceOrderId);
		trip.put("cod_amount", codAmount);
		trip.put("bill_amount", billAmount);
		trip.set("products", products);
		trip.set("notes", input.path("notes").isArray() ? (ArrayNode) input.path("notes")
				: objectMapper.createArrayNode());

		if (input.hasNonNull("promised_prep_time") || input.hasNonNull("promisedPrepTime")) {
			trip.put("promised_prep_time", String.valueOf(
					input.hasNonNull("promised_prep_time") ? input.get("promised_prep_time").asText()
							: input.get("promisedPrepTime").asText()));
		}
		if (input.hasNonNull("promised_delivery_time") || input.hasNonNull("promisedDeliveryTime")) {
			trip.put("promised_delivery_time", String.valueOf(
					input.hasNonNull("promised_delivery_time") ? input.get("promised_delivery_time").asText()
							: input.get("promisedDeliveryTime").asText()));
		}
		if (input.hasNonNull("delivery_date") || input.hasNonNull("deliveryDate")) {
			trip.put("delivery_date", String.valueOf(
					input.hasNonNull("delivery_date") ? input.get("delivery_date").asText()
							: input.get("deliveryDate").asText()));
		}
		if (input.hasNonNull("delivery_slot") || input.hasNonNull("deliverySlot")) {
			trip.put("delivery_slot", String.valueOf(
					input.hasNonNull("delivery_slot") ? input.get("delivery_slot").asText()
							: input.get("deliverySlot").asText()));
		}

		// Store/vendor logins: omit brand when omitBrand or when codes are unset (Pidge rejects empty brand.code).
		ObjectNode brand = null;
		if (!omitBrand) {
			if (input.has("brand") && input.get("brand").isObject()) {
				JsonNode b = input.get("brand");
				String code = textOr(b, "code", defaults.brandCode());
				String loc = textOr(b, "location_code", defaults.brandLocationCode());
				if (StringUtils.hasText(code) && StringUtils.hasText(loc)) {
					brand = objectMapper.createObjectNode();
					brand.put("code", code);
					brand.put("location_code", loc);
					brand.put("name", textOr(b, "name", defaults.brandName()));
				}
			} else if (StringUtils.hasText(defaults.brandCode()) && StringUtils.hasText(defaults.brandLocationCode())) {
				brand = objectMapper.createObjectNode();
				brand.put("code", defaults.brandCode());
				brand.put("location_code", defaults.brandLocationCode());
				brand.put("name", defaults.brandName());
			}
		}

		String channel = input.hasNonNull("channel") ? input.get("channel").asText() : defaults.channel();

		ObjectNode root = objectMapper.createObjectNode();
		if (brand != null) {
			root.set("brand", brand);
		}
		root.put("channel", channel);
		root.set("sender_detail", senderDetail);
		root.set("poc_detail", pocDetail);
		ArrayNode trips = objectMapper.createArrayNode();
		trips.add(trip);
		root.set("trips", trips);
		return root;
	}

	/**
	 * Removes {@code brand} when required for store/vendor accounts, strips internal flags {@code omitBrand} /
	 * {@code omit_brand} so they are not sent to Pidge.
	 */
	public JsonNode applyOmitBrandIfNeeded(JsonNode body) {
		if (!(body instanceof ObjectNode obj)) {
			return body;
		}
		boolean mustStripFlags = obj.has("omitBrand") || obj.has("omit_brand");
		boolean mustDropBrand = shouldOmitBrand(obj) && obj.has("brand");
		if (!mustStripFlags && !mustDropBrand) {
			return body;
		}
		ObjectNode copy = obj.deepCopy();
		if (shouldOmitBrand(copy)) {
			copy.remove("brand");
		}
		copy.remove("omitBrand");
		copy.remove("omit_brand");
		return copy;
	}

	private boolean shouldOmitBrand(JsonNode input) {
		if (input == null) {
			return pidgeProperties.isOmitBrandInCreateOrder();
		}
		if (input.path("omitBrand").asBoolean(false) || input.path("omit_brand").asBoolean(false)) {
			return true;
		}
		return pidgeProperties.isOmitBrandInCreateOrder();
	}

	/** Whether create-order should omit {@code brand} (caller reads before stripping {@code omitBrand} flags). */
	public boolean shouldOmitBrandForCreateOrder(JsonNode requestBody) {
		return shouldOmitBrand(requestBody);
	}

	/**
	 * True when the body is already in Pidge create-order shape and should be forwarded without building from
	 * simplified fields.
	 * <ul>
	 *   <li>Aggregator-style: {@code brand} object + non-empty {@code trips}</li>
	 *   <li>Store/vendor-style: {@code sender_detail} + non-empty {@code trips} (no {@code brand}; token fixes brand context)</li>
	 * </ul>
	 */
	public static boolean isNativeCreateOrderBody(JsonNode body) {
		if (body == null || !body.has("trips") || !body.get("trips").isArray() || body.get("trips").size() == 0) {
			return false;
		}
		if (body.has("brand") && body.get("brand").isObject()) {
			return true;
		}
		return body.has("sender_detail") && body.get("sender_detail").isObject();
	}

	private JsonNode firstObject(JsonNode input, String... keys) {
		for (String k : keys) {
			JsonNode n = input.path(k);
			if (n.isObject() && !n.isEmpty()) {
				return n;
			}
		}
		return objectMapper.createObjectNode();
	}

	private ObjectNode toAddress(JsonNode a, String fallbackCountry) {
		ObjectNode addr = objectMapper.createObjectNode();
		if (a == null || a.isNull() || (!a.isObject())) {
			addr.put("address_line_1", "");
			addr.put("city", "");
			addr.put("state", "");
			addr.put("country", fallbackCountry);
			addr.put("pincode", "");
			return addr;
		}
		String line1 = firstNonEmpty(
				text(a, "address_line_1", null),
				text(a, "street", null),
				text(a, "line1", null),
				text(a, "address", null));
		String line2 = firstNonEmpty(text(a, "address_line_2", null), text(a, "line2", null));
		addr.put("address_line_1", line1 != null ? line1 : "");
		if (line2 != null && !line2.isEmpty()) {
			addr.put("address_line_2", line2);
		}
		if (a.hasNonNull("label")) {
			addr.put("label", a.get("label").asText());
		}
		if (a.hasNonNull("landmark")) {
			addr.put("landmark", a.get("landmark").asText());
		}
		addr.put("city", a.hasNonNull("city") ? a.get("city").asText() : "");
		addr.put("state", a.hasNonNull("state") ? a.get("state").asText() : "");
		addr.put("country", a.hasNonNull("country") ? a.get("country").asText() : fallbackCountry);
		String pin = text(a, "pincode", "zip");
		addr.put("pincode", pin != null ? pin : "");
		if (a.has("latitude") && a.get("latitude").isNumber()) {
			addr.set("latitude", a.get("latitude"));
		} else if (a.has("lat") && a.get("lat").isNumber()) {
			addr.set("latitude", a.get("lat"));
		}
		if (a.has("longitude") && a.get("longitude").isNumber()) {
			addr.set("longitude", a.get("longitude"));
		} else if (a.has("lng") && a.get("lng").isNumber()) {
			addr.set("longitude", a.get("lng"));
		}
		if (a.hasNonNull("instructions_to_reach")) {
			addr.put("instructions_to_reach", a.get("instructions_to_reach").asText());
		}
		return addr;
	}

	private ObjectNode toReceiverSenderDetail(JsonNode block, String fallbackCountry) {
		JsonNode addrSource = block.has("address") && block.get("address").isObject()
				? block.get("address")
				: block;
		ObjectNode address = toAddress(addrSource, fallbackCountry);
		ObjectNode detail = objectMapper.createObjectNode();
		detail.set("address", address);
		detail.put("name", block.hasNonNull("name") ? block.get("name").asText() : "");
		String mobile = text(block, "mobile", "phone");
		detail.put("mobile", mobile != null ? mobile : "");
		detail.put("email", block.hasNonNull("email") ? block.get("email").asText() : "");
		return detail;
	}

	private ArrayNode buildProducts(JsonNode items) {
		ArrayNode out = objectMapper.createArrayNode();
		if (!items.isArray()) {
			return out;
		}
		for (JsonNode it : items) {
			if (!it.isObject()) {
				continue;
			}
			double qty = it.has("quantity") ? it.get("quantity").asDouble(1) : (it.has("units") ? it.get("units").asDouble(1) : 1);
			double price = 0;
			if (it.has("price")) price = it.get("price").asDouble(0);
			else if (it.has("selling_price")) price = it.get("selling_price").asDouble(0);
			else if (it.has("unit_price")) price = it.get("unit_price").asDouble(0);
			double deadWeight = resolveItemWeightGrams(it);
			ObjectNode p = objectMapper.createObjectNode();
			p.put("name", text(it, "name", "product_name") != null ? text(it, "name", "product_name") : "Item");
			String sku = text(it, "sku", "product_id");
			if (sku == null) sku = it.has("productId") ? it.get("productId").asText() : "";
			p.put("sku", sku != null ? sku : "");
			p.put("price", price);
			p.put("quantity", (int) Math.max(1, qty));
			ObjectNode dim = objectMapper.createObjectNode();
			dim.put("dead_weight", deadWeight);
			p.set("dimension", dim);
			if (it.hasNonNull("image_url")) {
				p.put("image_url", it.get("image_url").asText());
			}
			if (it.hasNonNull("force_action")) {
				p.put("force_action", it.get("force_action").asText());
			}
			out.add(p);
		}
		return out;
	}

	private ArrayNode packagesFromProducts(ArrayNode products) {
		ArrayNode packs = objectMapper.createArrayNode();
		for (JsonNode p : products) {
			String name = p.get("name").asText("Item");
			int qty = p.get("quantity").asInt(1);
			String sku = p.has("sku") ? p.get("sku").asText("") : "";
			double deadW = p.path("dimension").path("dead_weight").asDouble(100);
			ObjectNode pkg = objectMapper.createObjectNode();
			pkg.put("label", name);
			pkg.put("quantity", qty);
			if (!sku.isEmpty()) pkg.put("code", sku);
			pkg.put("dead_weight", 0);
			pkg.put("volumetric_weight", Math.max(1, Math.round(deadW)));
			pkg.put("length", 2);
			pkg.put("breadth", 2);
			pkg.put("height", 2);
			packs.add(pkg);
		}
		return packs;
	}

	private double resolveItemWeightGrams(JsonNode it) {
		if (it == null || it.isNull()) {
			return 100;
		}
		String[] keys = { "dead_weight", "weight_g", "packWeightGrams", "pack_weight_grams", "weightGrams" };
		for (String k : keys) {
			if (it.has(k) && it.get(k).isNumber()) {
				double v = it.get(k).asDouble();
				if (v > 0) {
					return v;
				}
			}
		}
		JsonNode dim = it.path("dimension");
		if (dim.isObject() && dim.has("dead_weight") && dim.get("dead_weight").isNumber()) {
			double v = dim.get("dead_weight").asDouble();
			if (v > 0) {
				return v;
			}
		}
		return 100;
	}

	private ArrayNode defaultPackages(JsonNode input) {
		double fallback = number(input, "packageWeightGrams", "totalWeightGrams", "weight_g", "pack_weight_grams");
		if (fallback <= 0) {
			fallback = 500;
		}
		ObjectNode pkg = objectMapper.createObjectNode();
		pkg.put("label", "Order");
		pkg.put("quantity", 1);
		pkg.put("dead_weight", 0);
		pkg.put("volumetric_weight", Math.max(1, Math.round(fallback)));
		pkg.put("length", 2);
		pkg.put("breadth", 2);
		pkg.put("height", 2);
		ArrayNode a = objectMapper.createArrayNode();
		a.add(pkg);
		return a;
	}

	private String text(JsonNode node, String... keys) {
		if (node == null || keys == null) {
			return null;
		}
		for (String k : keys) {
			if (k != null && node.hasNonNull(k)) {
				return node.get(k).asText();
			}
		}
		return null;
	}

	private String textOr(JsonNode b, String field, String fallback) {
		if (b != null && b.hasNonNull(field) && !b.get(field).asText().isBlank()) {
			return b.get(field).asText();
		}
		return fallback != null ? fallback : "";
	}

	private double number(JsonNode input, String... keys) {
		for (String k : keys) {
			if (input.has(k) && input.get(k).isNumber()) {
				return input.get(k).asDouble();
			}
		}
		return 0;
	}

	private String firstNonEmpty(String... v) {
		for (String s : v) {
			if (s != null && !s.isBlank()) {
				return s;
			}
		}
		return null;
	}

	private static String textOrEmpty(JsonNode n) {
		if (n == null || n.isNull()) {
			return "";
		}
		return n.asText("").trim();
	}

	private void coerceAddressForPidge(ObjectNode addr) {
		if (addr == null) {
			return;
		}
		String line1 = addr.path("address_line_1").asText("").trim();
		String city = addr.path("city").asText("").trim();
		if (!StringUtils.hasText(city)) {
			String state = addr.path("state").asText("").trim();
			String pin = addr.path("pincode").asText("").trim();
			String subLine = line1.length() > 0 ? line1.substring(0, Math.min(40, line1.length())) : null;
			String filled = firstNonEmpty(state, pin, subLine, "NA");
			addr.put("city", filled != null ? filled : "NA");
		}
		String stateVal = addr.path("state").asText("").trim();
		if (!StringUtils.hasText(stateVal)) {
			String cityNow = addr.path("city").asText("").trim();
			String pin = addr.path("pincode").asText("").trim();
			String filledSt = firstNonEmpty(cityNow, pin, "NA");
			addr.put("state", filledSt != null ? filledSt : "NA");
		}
		String lm = addr.has("landmark") ? addr.get("landmark").asText("").trim() : "";
		if (!StringUtils.hasText(lm)) {
			String fallbackLm = line1.length() > 0 ? line1.substring(0, Math.min(120, line1.length())) : "Location";
			addr.put("landmark", fallbackLm);
		}
	}

	private static void ensureNonEmptyEmail(ObjectNode detail, String fallback) {
		if (detail == null) {
			return;
		}
		String e = detail.path("email").asText("").trim();
		if (!StringUtils.hasText(e) && StringUtils.hasText(fallback)) {
			detail.put("email", fallback);
		}
	}

	public record BrandDefaults(
			String brandCode,
			String brandLocationCode,
			String brandName,
			String channel,
			String defaultCountry
	) {}
}
