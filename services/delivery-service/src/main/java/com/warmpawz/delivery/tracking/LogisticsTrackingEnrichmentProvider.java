package com.warmpawz.delivery.tracking;

import com.warmpawz.delivery.dto.tracking.DeliveryTrackingEnrichmentDto;

import java.util.Optional;

/** Future: Dunzo, Shadowfax, Porter, Delhivery implementations. */
public interface LogisticsTrackingEnrichmentProvider {

	String providerId();

	Optional<DeliveryTrackingEnrichmentDto> fetchLiveEnrichment(String externalTaskId);
}
