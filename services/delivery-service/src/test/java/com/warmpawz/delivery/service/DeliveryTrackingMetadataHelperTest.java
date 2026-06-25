package com.warmpawz.delivery.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DeliveryTrackingMetadataHelperTest {

	private final ObjectMapper objectMapper = new ObjectMapper();

	@Test
	void readsReassignPendingFlag() throws Exception {
		String json = objectMapper.writeValueAsString(
				objectMapper.createObjectNode().put("reassign_pending", true));
		assertTrue(DeliveryTrackingMetadataHelper.isReassignPending(json, objectMapper));
	}

	@Test
	void setAndClearReassignPending() throws Exception {
		UUID id = UUID.randomUUID();
		String withFlag = DeliveryTrackingMetadataHelper.setReassignPending("{}", objectMapper, id, Instant.now());
		assertTrue(DeliveryTrackingMetadataHelper.isReassignPending(withFlag, objectMapper));
		String cleared = DeliveryTrackingMetadataHelper.clearReassignPending(withFlag, objectMapper);
		assertFalse(DeliveryTrackingMetadataHelper.isReassignPending(cleared, objectMapper));
	}
}
