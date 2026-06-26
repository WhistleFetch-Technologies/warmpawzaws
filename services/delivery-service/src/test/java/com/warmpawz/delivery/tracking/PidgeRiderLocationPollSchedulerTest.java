package com.warmpawz.delivery.tracking;

import com.warmpawz.delivery.dto.tracking.DeliveryTrackingEnrichmentDto;
import com.warmpawz.delivery.entity.DeliveryTracking;
import com.warmpawz.delivery.repository.DeliveryTrackingRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PidgeRiderLocationPollSchedulerTest {

	@Mock
	private DeliveryTrackingRepository deliveryTrackingRepository;

	@Mock
	private DeliveryTrackingEnrichmentService trackingEnrichmentService;

	@InjectMocks
	private PidgeRiderLocationPollScheduler scheduler;

	@Test
	void pollActivePidgeRiderLocations_enrichesEachActiveRow() {
		DeliveryTracking first = activeTracking("on_the_way", "pidge-order-1");
		DeliveryTracking second = activeTracking("picked_up", "pidge-order-2");
		when(deliveryTrackingRepository.findActivePidgeTrackingsForLocationPoll())
				.thenReturn(List.of(first, second));
		when(trackingEnrichmentService.enrichIfApplicable(first))
				.thenReturn(Optional.of(DeliveryTrackingEnrichmentDto.builder().provider("pidge").build()));
		when(trackingEnrichmentService.enrichIfApplicable(second))
				.thenReturn(Optional.empty());

		scheduler.pollActivePidgeRiderLocations();

		verify(trackingEnrichmentService, times(1)).enrichIfApplicable(first);
		verify(trackingEnrichmentService, times(1)).enrichIfApplicable(second);
	}

	@Test
	void pollActivePidgeRiderLocations_skipsWhenNoActiveRows() {
		when(deliveryTrackingRepository.findActivePidgeTrackingsForLocationPoll())
				.thenReturn(List.of());

		scheduler.pollActivePidgeRiderLocations();

		verify(trackingEnrichmentService, never()).enrichIfApplicable(org.mockito.ArgumentMatchers.any());
	}

	@Test
	void pollActivePidgeRiderLocations_continuesAfterSingleFailure() {
		DeliveryTracking failing = activeTracking("nearby", "pidge-order-fail");
		DeliveryTracking succeeding = activeTracking("heading_to_pickup", "pidge-order-ok");
		when(deliveryTrackingRepository.findActivePidgeTrackingsForLocationPoll())
				.thenReturn(List.of(failing, succeeding));
		when(trackingEnrichmentService.enrichIfApplicable(failing))
				.thenThrow(new RuntimeException("Pidge timeout"));
		when(trackingEnrichmentService.enrichIfApplicable(succeeding))
				.thenReturn(Optional.empty());

		scheduler.pollActivePidgeRiderLocations();

		verify(trackingEnrichmentService, times(1)).enrichIfApplicable(failing);
		verify(trackingEnrichmentService, times(1)).enrichIfApplicable(succeeding);
	}

	private static DeliveryTracking activeTracking(String status, String externalTaskId) {
		DeliveryTracking tracking = new DeliveryTracking();
		tracking.setId(UUID.randomUUID());
		tracking.setStatus(status);
		tracking.setLogisticsPartner("pidge");
		tracking.setExternalTaskId(externalTaskId);
		return tracking;
	}
}
