package com.warmpawz.delivery.tracking;

import com.warmpawz.delivery.entity.DeliveryTracking;

import java.util.Collection;
import java.util.Locale;
import java.util.Set;

/** When live rider enrichment may be shown to customers. */
public final class DeliveryTrackingRiderVisibility {

	private static final Set<String> RIDER_VISIBLE = Set.of(
			"heading_to_pickup",
			"at_pickup",
			"picked_up",
			"on_the_way",
			"nearby");

	private DeliveryTrackingRiderVisibility() {
	}

	public static Collection<String> riderVisibleStatuses() {
		return RIDER_VISIBLE;
	}

	public static boolean shouldExposeRider(String internalStatus) {
		if (internalStatus == null || internalStatus.isBlank()) {
			return false;
		}
		return RIDER_VISIBLE.contains(internalStatus.trim().toLowerCase(Locale.ROOT));
	}

	/** Mirrors {@code DeliveryTrackingRepository#findActivePidgeTrackingsForLocationPoll} eligibility. */
	public static boolean matchesActivePidgeLocationPollCriteria(DeliveryTracking tracking) {
		if (tracking == null) {
			return false;
		}
		String partner = tracking.getLogisticsPartner();
		if (partner == null || !"pidge".equalsIgnoreCase(partner.trim())) {
			return false;
		}
		String externalTaskId = tracking.getExternalTaskId();
		if (externalTaskId == null || externalTaskId.isBlank()) {
			return false;
		}
		return shouldExposeRider(tracking.getStatus());
	}
}
