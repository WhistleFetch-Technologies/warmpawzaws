package com.warmpawz.delivery.tracking;

import com.warmpawz.delivery.entity.DeliveryTracking;
import com.warmpawz.delivery.repository.DeliveryTrackingRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Polls Pidge fulfillment/tracking for active deliveries and persists rider GPS to Postgres.
 * Customer read APIs use DB only — no per-request Pidge calls.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "pidge.rider-location-poll", name = "enabled", havingValue = "true")
public class PidgeRiderLocationPollScheduler {

	private final DeliveryTrackingRepository deliveryTrackingRepository;
	private final DeliveryTrackingEnrichmentService trackingEnrichmentService;

	@Scheduled(fixedDelayString = "${pidge.rider-location-poll.interval-ms:60000}")
	public void pollActivePidgeRiderLocations() {
		List<DeliveryTracking> active = deliveryTrackingRepository.findActivePidgeTrackingsForLocationPoll();
		if (active.isEmpty()) {
			log.debug("Pidge rider location poll: no active trackings");
			return;
		}

		log.debug("Pidge rider location poll: {} active trackings", active.size());
		for (DeliveryTracking tracking : active) {
			try {
				trackingEnrichmentService.enrichIfApplicable(tracking).ifPresentOrElse(
						dto -> log.debug("Pidge poll enriched tracking {} (providerStatus={})",
								tracking.getId(), dto.getProviderTrackingStatus()),
						() -> log.debug("Pidge poll skipped tracking {} (empty or inapplicable response)",
								tracking.getId()));
			} catch (Exception e) {
				log.warn("Pidge rider location poll failed for tracking {}: {}",
						tracking.getId(), e.getMessage());
			}
		}
	}
}
