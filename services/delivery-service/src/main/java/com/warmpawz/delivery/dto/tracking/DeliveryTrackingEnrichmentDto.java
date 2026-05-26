package com.warmpawz.delivery.dto.tracking;

import lombok.Builder;
import lombok.Value;

/**
 * Normalized live tracking enrichment from a logistics provider (live fetch; not persisted).
 */
@Value
@Builder
public class DeliveryTrackingEnrichmentDto {
	String provider;
	RiderInfoDto rider;
	LiveLocationDto location;
	Integer etaMinutes;
	String providerTrackingStatus;
	String trackingUrl;
}
