package com.warmpawz.delivery.tracking;

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

	public static boolean shouldExposeRider(String internalStatus) {
		if (internalStatus == null || internalStatus.isBlank()) {
			return false;
		}
		return RIDER_VISIBLE.contains(internalStatus.trim().toLowerCase(Locale.ROOT));
	}
}
