package com.warmpawz.delivery.service.serviceimpl;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Ensures sandbox composite strings (e.g. {@code fulfilled|delivered}) win over bare {@code fulfilled}.
 */
class PidgeWebhookStatusResolveTest {

	@Test
	void fulfilledDeliveredInDummyStatus_mapsToDelivered() {
		var r = PidgeWebhookProcessingService.resolvePidgeStatus("", "fulfilled", "fulfilled|delivered");
		assertEquals("delivered", r.normalized());
		assertEquals("fulfilled|delivered", r.compositeKey());
	}

	@Test
	void fulfilledDeliveredInFulfillmentStatus_mapsToDelivered_evenWhenParentIsFulfilled() {
		var r = PidgeWebhookProcessingService.resolvePidgeStatus("fulfilled|delivered", "fulfilled", "");
		assertEquals("delivered", r.normalized());
		assertEquals("fulfilled|delivered", r.compositeKey());
	}

	@Test
	void fulfilledDeliveredInParent_mapsToDelivered() {
		var r = PidgeWebhookProcessingService.resolvePidgeStatus("", "fulfilled|delivered", "");
		assertEquals("delivered", r.normalized());
	}

	@Test
	void bareFulfilledParent_mapsToInTransit() {
		var r = PidgeWebhookProcessingService.resolvePidgeStatus("", "fulfilled", "");
		assertEquals("in_transit", r.normalized());
		assertEquals("fulfilled", r.compositeKey());
	}

	@Test
	void fulfilledPickedUp_composite_mapsToPickedUp() {
		var r = PidgeWebhookProcessingService.resolvePidgeStatus("fulfilled|picked_up", "", "");
		assertEquals("picked_up", r.normalized());
	}

	@Test
	void fulfilledOnTheWay_composite_mapsToInTransit() {
		var r = PidgeWebhookProcessingService.resolvePidgeStatus("fulfilled|on_the_way", "", "");
		assertEquals("in_transit", r.normalized());
	}

	@Test
	void deliveredFf_still_mapsWhenNoComposite() {
		var r = PidgeWebhookProcessingService.resolvePidgeStatus("DELIVERED", "", "");
		assertEquals("delivered", r.normalized());
		assertEquals("", r.compositeKey());
	}
}
