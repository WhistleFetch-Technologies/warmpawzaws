package com.warmpawz.delivery.service.serviceimpl;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PidgeRiderTaskWebhookTest {

	private final ObjectMapper objectMapper = new ObjectMapper();

	@Test
	void detectsRiderTaskPayload() throws Exception {
		String json =
				"""
				{
				  "rider": { "id": 1, "name": "R", "mobile": "9", "current_latitude": 28.1, "current_longitude": 77.1 },
				  "order_details": [{ "reference_id": "x", "order_id": 1, "id": "ff1", "status": "CREATED" }],
				  "update_source": "RIDER",
				  "event_timestamp": 1778500477813
				}
				""";
		assertTrue(PidgeWebhookProcessingService.isRiderTaskPayload(objectMapper.readTree(json)));
	}

	@Test
	void doesNotTreatStatusWebhookAsRiderTask() throws Exception {
		String json =
				"""
				{
				  "id": "pidge-1",
				  "reference_id": "meal-1",
				  "status": "fulfilled",
				  "fulfillment": { "status": "PICKED_UP", "logs": [] }
				}
				""";
		assertFalse(PidgeWebhookProcessingService.isRiderTaskPayload(objectMapper.readTree(json)));
	}
}
