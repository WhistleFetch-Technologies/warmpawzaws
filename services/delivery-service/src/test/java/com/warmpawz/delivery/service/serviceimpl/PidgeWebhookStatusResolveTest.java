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

	@Test
	void parentPlaced_mapsToPending() {
		var r = PidgeWebhookProcessingService.resolvePidgeStatus("", "placed", "");
		assertEquals("pending", r.normalized());
	}

	@Test
	void parentPLACED_mapsToPending() {
		var r = PidgeWebhookProcessingService.resolvePidgeStatus("", "PLACED", "");
		assertEquals("pending", r.normalized());
	}

	@Test
	void parentManifested_mapsToPickupScheduled() {
		var r = PidgeWebhookProcessingService.resolvePidgeStatus("", "manifested", "");
		assertEquals("pickup_scheduled", r.normalized());
	}

	@Test
	void parentMANIFESTED_mapsToPickupScheduled() {
		var r = PidgeWebhookProcessingService.resolvePidgeStatus("", "MANIFESTED", "");
		assertEquals("pickup_scheduled", r.normalized());
	}

	@Test
	void fulfillmentPlaced_mapsToPending() {
		var r = PidgeWebhookProcessingService.resolvePidgeStatus("placed", "", "");
		assertEquals("pending", r.normalized());
	}

	@Test
	void fulfillmentMANIFESTED_mapsToPickupScheduled() {
		var r = PidgeWebhookProcessingService.resolvePidgeStatus("MANIFESTED", "", "");
		assertEquals("pickup_scheduled", r.normalized());
	}

	@Test
	void unknownParentStatus_mapsToUnknown() {
		var r = PidgeWebhookProcessingService.resolvePidgeStatus("", "awaiting_allocation", "");
		assertEquals("unknown", r.normalized());
	}

	@Test
	void fulfillmentOutForPickup_still_mapsToPickupScheduled() {
		var r = PidgeWebhookProcessingService.resolvePidgeStatus("OUT_FOR_PICKUP", "", "");
		assertEquals("pickup_scheduled", r.normalized());
	}

	@Test
	void parentManifested_doesNotOverrideDeliveredFulfillment() {
		var r = PidgeWebhookProcessingService.resolvePidgeStatus("DELIVERED", "manifested", "");
		assertEquals("delivered", r.normalized());
	}
}
