package com.warmpawz.delivery.tracking;

import com.warmpawz.delivery.entity.DeliveryTracking;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DeliveryTrackingRepositoryLocationPollTest {

	@Test
	void matchesActivePidgeLocationPollCriteria_acceptsActivePidgeRow() {
		DeliveryTracking tracking = new DeliveryTracking();
		tracking.setId(UUID.randomUUID());
		tracking.setLogisticsPartner("Pidge");
		tracking.setExternalTaskId("ext-123");
		tracking.setStatus("on_the_way");

		assertTrue(DeliveryTrackingRiderVisibility.matchesActivePidgeLocationPollCriteria(tracking));
	}

	@Test
	void matchesActivePidgeLocationPollCriteria_rejectsNonPidgePartner() {
		DeliveryTracking tracking = new DeliveryTracking();
		tracking.setLogisticsPartner("shiprocket");
		tracking.setExternalTaskId("ext-123");
		tracking.setStatus("on_the_way");

		assertFalse(DeliveryTrackingRiderVisibility.matchesActivePidgeLocationPollCriteria(tracking));
	}

	@Test
	void matchesActivePidgeLocationPollCriteria_rejectsMissingExternalTaskId() {
		DeliveryTracking tracking = new DeliveryTracking();
		tracking.setLogisticsPartner("pidge");
		tracking.setExternalTaskId("   ");
		tracking.setStatus("picked_up");

		assertFalse(DeliveryTrackingRiderVisibility.matchesActivePidgeLocationPollCriteria(tracking));
	}

	@Test
	void matchesActivePidgeLocationPollCriteria_rejectsTerminalOrPreRiderStatuses() {
		DeliveryTracking delivered = tracking("pidge", "ext-1", "delivered");
		DeliveryTracking preparing = tracking("pidge", "ext-2", "preparing");

		assertFalse(DeliveryTrackingRiderVisibility.matchesActivePidgeLocationPollCriteria(delivered));
		assertFalse(DeliveryTrackingRiderVisibility.matchesActivePidgeLocationPollCriteria(preparing));
	}

	private static DeliveryTracking tracking(String partner, String externalTaskId, String status) {
		DeliveryTracking tracking = new DeliveryTracking();
		tracking.setLogisticsPartner(partner);
		tracking.setExternalTaskId(externalTaskId);
		tracking.setStatus(status);
		return tracking;
	}
}
