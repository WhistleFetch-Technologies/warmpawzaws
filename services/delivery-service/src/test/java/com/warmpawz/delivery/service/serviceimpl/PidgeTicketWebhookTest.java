package com.warmpawz.delivery.service.serviceimpl;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PidgeTicketWebhookTest {

	private final ObjectMapper objectMapper = new ObjectMapper();

	@Test
	void detectsTicketStatusPayload() throws Exception {
		String json =
				"""
				{
				  "pidge_id": "17783202545742C2D8HC7",
				  "issue_category": "OTHERS",
				  "issue_subcategory": "RIDER_BEHAVIOR",
				  "description": "ORDER NOT YET DELIVERED",
				  "ticket_id": "is-qgmxxAyXOgVZPo9qHBHM2YUOW9t6XQ65ALEVX",
				  "status": "OPEN",
				  "created_at": "2024-09-27T04:24:53.818Z",
				  "updated_at": "2024-09-27T04:24:53.818Z",
				  "order_status": "shipped"
				}
				""";
		assertTrue(PidgeTicketWebhookProcessingService.isTicketStatusPayload(objectMapper.readTree(json)));
	}

	@Test
	void doesNotTreatOrderStatusWebhookAsTicket() throws Exception {
		String json =
				"""
				{
				  "id": "pidge-order-1",
				  "reference_id": "meal-1",
				  "status": "fulfilled",
				  "fulfillment": { "status": "PICKED_UP", "logs": [] }
				}
				""";
		assertFalse(PidgeTicketWebhookProcessingService.isTicketStatusPayload(objectMapper.readTree(json)));
	}

	@Test
	void doesNotTreatRiderTaskAsTicket() throws Exception {
		String json =
				"""
				{
				  "rider": { "id": 1 },
				  "order_details": [{ "reference_id": "x", "status": "CREATED" }],
				  "event_timestamp": 1
				}
				""";
		assertFalse(PidgeTicketWebhookProcessingService.isTicketStatusPayload(objectMapper.readTree(json)));
	}
}
