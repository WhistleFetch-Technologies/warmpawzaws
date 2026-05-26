package com.warmpawz.delivery.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

/**
 * Pidge Partial Delivery Workflow — create order with line-level {@code products} and webhook
 * {@code return_order_info} handling (see Pidge Integration APIs collection).
 */
public final class PidgePartialDeliverySupport {

	private PidgePartialDeliverySupport() {}

	/**
	 * Store-channel flat create body: {@code source_order_id}, {@code products[]}, {@code customer_detail}
	 * (no {@code trips} wrapper). Same upstream path as POST /v1.0/store/channel/vendor/order.
	 */
	public static boolean isPartialDeliveryCreateOrderBody(JsonNode body) {
		if (body == null || !body.isObject()) {
			return false;
		}
		if (body.has("trips") && body.get("trips").isArray() && body.get("trips").size() > 0) {
			return false;
		}
		if (PidgeOrderPayloadBuilder.isNativeCreateOrderBody(body)) {
			return false;
		}
		JsonNode products = body.get("products");
		if (products == null || !products.isArray() || products.isEmpty()) {
			return false;
		}
		String sourceOrderId = text(body, "source_order_id", "sourceOrderId");
		if (sourceOrderId == null || sourceOrderId.isBlank()) {
			return false;
		}
		return body.has("customer_detail") || body.has("sender_detail");
	}

	/**
	 * Applies Pidge partial-delivery amount rules before POST create-order:
	 * bill/COD summation from priced line items when COD is non-zero.
	 */
	public static ObjectNode normalizePartialDeliveryCreateOrder(ObjectMapper mapper, JsonNode body) {
		ObjectNode out = body instanceof ObjectNode obj ? obj.deepCopy() : mapper.valueToTree(body);
		ArrayNode products = out.has("products") && out.get("products").isArray()
				? (ArrayNode) out.get("products")
				: mapper.createArrayNode();

		double pricedSum = 0;
		boolean anyPricedLine = false;
		for (JsonNode p : products) {
			if (!p.isObject()) {
				continue;
			}
			double price = p.has("price") ? p.get("price").asDouble(0) : 0;
			if (price <= 0) {
				continue;
			}
			anyPricedLine = true;
			double qty = p.has("quantity") ? p.get("quantity").asDouble(1) : 1;
			pricedSum += price * Math.max(1, qty);
		}

		double cod = out.has("cod_amount") ? out.get("cod_amount").asDouble(0)
				: (out.has("codAmount") ? out.get("codAmount").asDouble(0) : 0);

		if (anyPricedLine) {
			out.put("bill_amount", pricedSum);
			if (cod != 0) {
				out.put("cod_amount", pricedSum);
			}
		}
		return out;
	}

	public static boolean hasReturnOrderInfo(JsonNode payload) {
		JsonNode info = payload == null ? null : payload.get("return_order_info");
		return info != null && info.isObject() && !info.isEmpty();
	}

	public static String extractReturnOrderId(JsonNode payload) {
		if (!hasReturnOrderInfo(payload)) {
			return null;
		}
		JsonNode info = payload.get("return_order_info");
		if (info.hasNonNull("order_id")) {
			return info.get("order_id").asText().trim();
		}
		return null;
	}

	public static boolean isReturnWorkflowComplete(String fulfillmentStatusUpper) {
		return "RTO_DELIVERED".equals(fulfillmentStatusUpper);
	}

	private static String text(JsonNode node, String... keys) {
		for (String k : keys) {
			if (node != null && node.hasNonNull(k)) {
				return node.get(k).asText();
			}
		}
		return null;
	}
}
