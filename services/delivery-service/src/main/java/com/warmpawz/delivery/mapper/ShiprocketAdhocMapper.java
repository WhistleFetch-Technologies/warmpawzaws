package com.warmpawz.delivery.mapper;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.experimental.UtilityClass;

import java.time.LocalDate;

/**
 * Maps client JSON (monolith /logistics/shiprocket/create-order shape) to Shiprocket adhoc API body.
 */
@UtilityClass
public class ShiprocketAdhocMapper {

	public static ObjectNode toAdhocPayload(JsonNode orderData, ObjectMapper mapper) {
		ObjectNode root = mapper.createObjectNode();
		root.put("order_id", text(orderData, "orderId"));
		root.put("order_date", orderData.hasNonNull("orderDate") ? orderData.get("orderDate").asText()
				: LocalDate.now().toString());
		String pl = text(orderData, "pickupLocation");
		root.put("pickup_location", pl.isEmpty() ? "Primary" : pl);
		JsonNode bill = orderData.path("billingAddress");
		root.put("billing_customer_name", text(orderData, "customerName"));
		root.put("billing_address", text(bill, "street"));
		root.put("billing_city", text(bill, "city"));
		root.put("billing_pincode", text(bill, "pincode"));
		root.put("billing_state", text(bill, "state"));
		root.put("billing_email", text(orderData, "customerEmail"));
		root.put("billing_phone", text(orderData, "customerPhone"));
		boolean shipIsBill = !orderData.has("shippingIsBilling") || orderData.get("shippingIsBilling").asBoolean(true);
		root.put("shipping_is_billing", shipIsBill);
		JsonNode ship = orderData.path("shippingAddress");
		root.put("shipping_customer_name",
				ship.hasNonNull("name") ? ship.get("name").asText() : text(orderData, "customerName"));
		root.put("shipping_address", ship.hasNonNull("street") ? ship.get("street").asText() : text(bill, "street"));
		root.put("shipping_city", ship.hasNonNull("city") ? ship.get("city").asText() : text(bill, "city"));
		root.put("shipping_pincode",
				ship.hasNonNull("pincode") ? ship.get("pincode").asText() : text(bill, "pincode"));
		root.put("shipping_state",
				ship.hasNonNull("state") ? ship.get("state").asText() : text(bill, "state"));
		ArrayNode items = mapper.createArrayNode();
		if (orderData.path("items").isArray()) {
			for (JsonNode item : orderData.path("items")) {
				ObjectNode r = mapper.createObjectNode();
				r.put("name", item.hasNonNull("name") ? item.get("name").asText() : "Item");
				r.put("sku", item.hasNonNull("sku") ? item.get("sku").asText()
						: (item.hasNonNull("productId") ? item.get("productId").asText() : ""));
				r.put("units", item.path("quantity").asInt(1));
				r.put("selling_price", item.path("price").asDouble(0));
				items.add(r);
			}
		}
		root.set("order_items", items);
		String pm = orderData.hasNonNull("paymentMethod") ? orderData.get("paymentMethod").asText("prepaid") : "prepaid";
		root.put("payment_method", "cod".equalsIgnoreCase(pm) ? "COD" : "Prepaid");
		root.put("sub_total", orderData.path("subTotal").asDouble(0));
		return root;
	}

	private static String text(JsonNode n, String field) {
		return n.hasNonNull(field) ? n.get(field).asText() : "";
	}
}
