package com.warmpawz.delivery.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PidgePartialDeliverySupportTest {

	private final ObjectMapper mapper = new ObjectMapper();

	@Test
	void detectsPartialDeliveryCreateBody() throws Exception {
		String json =
				"""
				{
				  "source_order_id": "PP1010",
				  "reference_id": "dd9pdg637",
				  "bill_amount": 1200,
				  "cod_amount": 1200,
				  "customer_detail": { "name": "M", "mobile": "9", "address": { "address_line_1": "x", "city": "c", "state": "s", "pincode": "1" } },
				  "sender_detail": { "name": "R", "mobile": "9", "address": { "address_line_1": "x", "city": "c", "state": "s", "pincode": "1" } },
				  "poc_detail": { "name": "B", "mobile": "9" },
				  "products": [{ "name": "A", "sku": "1", "price": 400, "quantity": 2 }]
				}
				""";
		assertTrue(PidgePartialDeliverySupport.isPartialDeliveryCreateOrderBody(mapper.readTree(json)));
	}

	@Test
	void normalizesBillAndCodFromProducts() throws Exception {
		ObjectNode body = mapper.createObjectNode();
		body.put("source_order_id", "PP1010");
		body.put("cod_amount", 500);
		body.put("bill_amount", 999);
		var products = body.putArray("products");
		var p1 = products.addObject();
		p1.put("name", "A");
		p1.put("price", 400);
		p1.put("quantity", 2);
		var p2 = products.addObject();
		p2.put("name", "B");
		p2.put("price", 100);
		p2.put("quantity", 1);
		body.set("customer_detail", mapper.createObjectNode().put("name", "c"));
		body.set("sender_detail", mapper.createObjectNode().put("name", "s"));

		ObjectNode out = PidgePartialDeliverySupport.normalizePartialDeliveryCreateOrder(mapper, body);
		assertEquals(900.0, out.get("bill_amount").asDouble());
		assertEquals(900.0, out.get("cod_amount").asDouble());
	}

	@Test
	void leavesCodZeroWhenNoProductPrices() {
		ObjectNode body = mapper.createObjectNode();
		body.put("source_order_id", "PP1010");
		body.put("cod_amount", 500);
		var products = body.putArray("products");
		products.addObject().put("name", "A").put("quantity", 1);
		body.set("customer_detail", mapper.createObjectNode());
		body.set("sender_detail", mapper.createObjectNode());

		ObjectNode out = PidgePartialDeliverySupport.normalizePartialDeliveryCreateOrder(mapper, body);
		assertEquals(500.0, out.get("cod_amount").asDouble());
	}

	@Test
	void detectsReturnOrderInfo() throws Exception {
		String json =
				"""
				{ "id": "o1", "fulfillment": { "status": "DELIVERED" },
				  "return_order_info": { "order_id": "ret-99", "products": [] } }
				""";
		assertTrue(PidgePartialDeliverySupport.hasReturnOrderInfo(mapper.readTree(json)));
		assertEquals("ret-99", PidgePartialDeliverySupport.extractReturnOrderId(mapper.readTree(json)));
	}

	@Test
	void tripsBodyIsNotPartialDelivery() throws Exception {
		String json =
				"""
				{ "sender_detail": {}, "trips": [{ "source_order_id": "x", "products": [] }] }
				""";
		assertFalse(PidgePartialDeliverySupport.isPartialDeliveryCreateOrderBody(mapper.readTree(json)));
	}
}
