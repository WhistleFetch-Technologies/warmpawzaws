package com.warmpawz.delivery.tracking;

import com.warmpawz.delivery.dto.tracking.DeliveryTrackingEnrichmentDto;
import com.warmpawz.delivery.dto.tracking.LiveLocationDto;
import com.warmpawz.delivery.dto.tracking.RiderInfoDto;
import com.warmpawz.delivery.entity.DeliveryTracking;
import com.warmpawz.delivery.repository.DeliveryTrackingRepository;
import com.warmpawz.delivery.service.DeliveryLocationHistoryWriter;
import com.warmpawz.delivery.service.GpsSanityFilter;
import com.warmpawz.delivery.service.MealOrderDestinationResolver;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class DeliveryTrackingEnrichmentService {

	private final PidgeTrackingEnrichmentProvider pidgeProvider;
	private final DeliveryTrackingRepository deliveryTrackingRepository;
	private final DeliveryLocationHistoryWriter deliveryLocationHistoryWriter;
	private final MealOrderDestinationResolver mealOrderDestinationResolver;

	public Optional<DeliveryTrackingEnrichmentDto> enrichIfApplicable(DeliveryTracking tracking) {
		if (tracking == null) {
			return Optional.empty();
		}
		String partner = tracking.getLogisticsPartner() != null
				? tracking.getLogisticsPartner().trim().toLowerCase(Locale.ROOT)
				: "";
		if (!PidgeTrackingEnrichmentProvider.PROVIDER_ID.equals(partner)) {
			return Optional.empty();
		}
		if (!DeliveryTrackingRiderVisibility.shouldExposeRider(tracking.getStatus())) {
			return Optional.empty();
		}
		String externalId = tracking.getExternalTaskId();
		if (externalId == null || externalId.isBlank()) {
			return Optional.empty();
		}
		Optional<DeliveryTrackingEnrichmentDto> enriched = pidgeProvider.fetchLiveEnrichment(externalId);
		enriched.ifPresent(dto -> persistEnrichmentSideEffects(tracking, dto));
		return enriched;
	}

	private void persistEnrichmentSideEffects(DeliveryTracking tracking, DeliveryTrackingEnrichmentDto dto) {
		boolean dirty = false;
		if (dto.getRider() != null) {
			String photo = dto.getRider().getRiderPhoto();
			if (photo != null && !photo.isBlank()
					&& (tracking.getDeliveryPersonPhoto() == null || tracking.getDeliveryPersonPhoto().isBlank())) {
				tracking.setDeliveryPersonPhoto(photo);
				dirty = true;
			}
		}
		if (dto.getLocation() != null) {
			var lat = java.math.BigDecimal.valueOf(dto.getLocation().getLatitude());
			var lng = java.math.BigDecimal.valueOf(dto.getLocation().getLongitude());
			if (DeliveryLocationHistoryWriter.isValidCoord(lat, lng)) {
				var destination = tracking.getMealOrderId() != null
						? mealOrderDestinationResolver.resolveDestination(tracking.getMealOrderId())
						: java.util.Optional.<GpsSanityFilter.GpsPoint>empty();
				var reject = GpsSanityFilter.rejectReason(
						tracking.getCurrentLat(),
						tracking.getCurrentLng(),
						tracking.getLastLocationUpdate(),
						lat,
						lng,
						java.time.Instant.now(),
						tracking.getPickedUpAt(),
						destination.orElse(null));
				if (reject.isPresent()) {
					log.warn(
							"[PIDGE GPS] poll rejected trackingId={} mealOrderId={} reason={}",
							tracking.getId(),
							tracking.getMealOrderId(),
							reject.get());
				} else if (!DeliveryLocationHistoryWriter.coordsEqual(
						tracking.getCurrentLat(), tracking.getCurrentLng(), lat, lng)) {
					tracking.setCurrentLat(lat);
					tracking.setCurrentLng(lng);
					tracking.setLastLocationUpdate(java.time.Instant.now());
					dirty = true;
				}
				if (reject.isEmpty()) {
					deliveryLocationHistoryWriter.appendIfChanged(
							tracking.getId(), lat, lng, "pidge", java.time.Instant.now());
				}
			}
		}
		if (dirty) {
			deliveryTrackingRepository.save(tracking);
		}
	}

	/** Merges normalized enrichment into the tracking map returned by delivery APIs. */
	public void mergeIntoTrackingMap(Map<String, Object> tracking, DeliveryTrackingEnrichmentDto enrichment) {
		if (tracking == null || enrichment == null) {
			return;
		}

		if (enrichment.getRider() != null) {
			Map<String, Object> rider = riderToMap(enrichment.getRider());
			tracking.put("rider", rider);
			@SuppressWarnings("unchecked")
			Map<String, Object> deliveryPerson = tracking.get("deliveryPerson") instanceof Map<?, ?> m
					? new LinkedHashMap<>((Map<String, Object>) m)
					: new LinkedHashMap<>();
			if (enrichment.getRider().getRiderName() != null && !enrichment.getRider().getRiderName().isBlank()) {
				deliveryPerson.put("name", enrichment.getRider().getRiderName());
			}
			if (enrichment.getRider().getRiderPhone() != null && !enrichment.getRider().getRiderPhone().isBlank()) {
				deliveryPerson.put("phone", enrichment.getRider().getRiderPhone());
			}
			if (enrichment.getRider().getVehicleNumber() != null && !enrichment.getRider().getVehicleNumber().isBlank()) {
				deliveryPerson.put("vehicleNumber", enrichment.getRider().getVehicleNumber());
			}
			if (enrichment.getRider().getVehicleType() != null && !enrichment.getRider().getVehicleType().isBlank()) {
				deliveryPerson.put("vehicleType", enrichment.getRider().getVehicleType());
			}
			if (enrichment.getRider().getRiderPhoto() != null && !enrichment.getRider().getRiderPhoto().isBlank()) {
				deliveryPerson.put("photo", enrichment.getRider().getRiderPhoto());
			}
			tracking.put("deliveryPerson", deliveryPerson);
		}

		if (enrichment.getLocation() != null) {
			Map<String, Object> loc = locationToMap(enrichment.getLocation());
			tracking.put("location", loc);
			tracking.put("currentLocation", Map.of(
					"lat", enrichment.getLocation().getLatitude(),
					"lng", enrichment.getLocation().getLongitude()));
		}

		if (enrichment.getEtaMinutes() != null) {
			tracking.put("eta", enrichment.getEtaMinutes());
			tracking.put("etaMinutes", enrichment.getEtaMinutes());
		}

		if (enrichment.getProviderTrackingStatus() != null) {
			tracking.put("providerTrackingStatus", enrichment.getProviderTrackingStatus());
		}

		if (enrichment.getTrackingUrl() != null && !enrichment.getTrackingUrl().isBlank()) {
			tracking.put("trackingUrl", enrichment.getTrackingUrl());
		}

		tracking.put("liveTrackingSource", enrichment.getProvider());
	}

	private static Map<String, Object> riderToMap(RiderInfoDto rider) {
		Map<String, Object> m = new LinkedHashMap<>();
		if (rider.getRiderName() != null) {
			m.put("name", rider.getRiderName());
		}
		if (rider.getRiderPhone() != null) {
			m.put("phone", rider.getRiderPhone());
		}
		if (rider.getRiderId() != null) {
			m.put("id", rider.getRiderId());
		}
		if (rider.getVehicleType() != null) {
			m.put("vehicleType", rider.getVehicleType());
		}
		if (rider.getVehicleNumber() != null) {
			m.put("vehicleNumber", rider.getVehicleNumber());
		}
		if (rider.getRiderPhoto() != null) {
			m.put("photo", rider.getRiderPhoto());
		}
		return m;
	}

	private static Map<String, Object> locationToMap(LiveLocationDto location) {
		Map<String, Object> m = new LinkedHashMap<>();
		m.put("latitude", location.getLatitude());
		m.put("longitude", location.getLongitude());
		return m;
	}
}
