package com.warmpawz.delivery.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PidgeMealCancellationSupportTest {

	private final ObjectMapper objectMapper = new ObjectMapper();

	@Test
	void cancelIdempotencyKey_isStablePerPidgeOrder() {
		assertEquals(
				"pidge:hyperlocal:meal_cancel:1780468284252H6FL0VQV",
				PidgeMealCancellationSupport.cancelIdempotencyKey("1780468284252H6FL0VQV"));
	}

	@Test
	void extractCancellationReason_includesParentFulfillmentAndRemark() throws Exception {
		var lastLog = objectMapper.readTree(
				"""
				{"status":"CANCELLED","remark":"No rider found in zone","timestamp":1778500477813}
				""");
		String reason = PidgeMealCancellationSupport.extractCancellationReason(
				"cancelled", "CANCELLED", "", lastLog);
		assertTrue(reason.startsWith("pidge_logistics_cancelled"));
		assertTrue(reason.contains("parent=cancelled"));
		assertTrue(reason.contains("fulfillment=CANCELLED"));
		assertTrue(reason.contains("remark=No rider found"));
	}

	@Test
	void toCustomerCancellationMessage_neverExposesAuditTokens() {
		String audit =
				PidgeMealCancellationSupport.extractCancellationReason("cancelled", "CANCELLED", null, null);
		assertEquals("Your refund is being processed.", PidgeMealCancellationSupport.toCustomerCancellationMessage(audit));
	}

	@Test
	void toCustomerCancellationMessage_usesRemarkWhenPresent() throws Exception {
		var lastLog = objectMapper.readTree(
				"""
				{"status":"CANCELLED","remark":"No rider found in zone","timestamp":1778500477813}
				""");
		String audit = PidgeMealCancellationSupport.extractCancellationReason(
				"cancelled", "CANCELLED", "", lastLog);
		assertEquals("No rider found in zone", PidgeMealCancellationSupport.toCustomerCancellationMessage(audit));
	}
}
