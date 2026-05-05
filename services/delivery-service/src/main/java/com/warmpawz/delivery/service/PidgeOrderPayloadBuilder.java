package com.warmpawz.delivery.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Builds Pidge create-order JSON from the compact Warmpawz-style body
 * (mirrors {@code buildPidgeOrderPayloadFromSimplified} in {@code pidge-logistics.ts}).
 */
@Component
@RequiredArgsConstructor
public class PidgeOrderPayloadBuilder {

	private final ObjectMapper objectMapper;

	public ObjectNode buildFromSimplified(JsonNode input, BrandDefaults defaults) {
		String sourceOrderId = text(input, "sourceOrderId", "source_order_id", "orderId");
		sourceOrderId = sourceOrderId == null ? "" : sourceOrderId.trim();
		if (sourceOrderId.isEmpty()) {
			throw new IllegalArgumentException("sourceOrderId or orderId is required");
		}

		JsonNode senderRaw = firstObject(input, "sender", "pickup", "senderDetail");
		JsonNode receiverRaw = firstObject(input, "receiver", "delivery", "receiverDetail");
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
		double billAmount = number(input, "billAmount", "bill_amount", "subTotal", "orderValue");
		double codAmount = number(input, "codAmount", "cod_amount");

		ArrayNode packagesFromItems = packagesFromProducts(products);
		if (packagesFromItems.isEmpty()) {
			packagesFromItems = defaultPackages();
		}

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

		ObjectNode brand;
		if (input.has("brand") && input.get("brand").isObject()) {
			JsonNode b = input.get("brand");
			brand = objectMapper.createObjectNode();
			brand.put("code", textOr(b, "code", defaults.brandCode()));
			brand.put("location_code", textOr(b, "location_code", defaults.brandLocationCode()));
			brand.put("name", textOr(b, "name", defaults.brandName()));
		} else {
			brand = objectMapper.createObjectNode();
			brand.put("code", defaults.brandCode());
			brand.put("location_code", defaults.brandLocationCode());
			brand.put("name", defaults.brandName());
		}

		String channel = input.hasNonNull("channel") ? input.get("channel").asText() : defaults.channel();

		ObjectNode root = objectMapper.createObjectNode();
		root.set("brand", brand);
		root.put("channel", channel);
		root.set("sender_detail", senderDetail);
		root.set("poc_detail", pocDetail);
		ArrayNode trips = objectMapper.createArrayNode();
		trips.add(trip);
		root.set("trips", trips);
		return root;
	}

	public static boolean isNativeCreateOrderBody(JsonNode body) {
		return body != null
				&& body.has("brand") && body.get("brand").isObject()
				&& body.has("trips") && body.get("trips").isArray()
				&& body.get("trips").size() > 0;
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
			double deadWeight =
					it.has("dead_weight") ? it.get("dead_weight").asDouble(100)
							: (it.has("weight_g") ? it.get("weight_g").asDouble(100) : 100);
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

	private ArrayNode defaultPackages() {
		ObjectNode pkg = objectMapper.createObjectNode();
		pkg.put("label", "Order");
		pkg.put("quantity", 1);
		pkg.put("dead_weight", 0);
		pkg.put("volumetric_weight", 500);
		pkg.put("length", 2);
		pkg.put("breadth", 2);
		pkg.put("height", 2);
		ArrayNode a = objectMapper.createArrayNode();
		a.add(pkg);
		return a;
	}

	private String text(JsonNode node, String primary, String alternate) {
		if (node != null && node.hasNonNull(primary)) {
			return node.get(primary).asText();
		}
		if (alternate != null && node != null && node.hasNonNull(alternate)) {
			return node.get(alternate).asText();
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

	public record BrandDefaults(
			String brandCode,
			String brandLocationCode,
			String brandName,
			String channel,
			String defaultCountry
	) {}
}
