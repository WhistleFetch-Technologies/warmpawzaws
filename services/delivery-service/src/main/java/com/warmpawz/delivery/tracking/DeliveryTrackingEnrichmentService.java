package com.warmpawz.delivery.tracking;

import com.warmpawz.delivery.dto.tracking.DeliveryTrackingEnrichmentDto;
import com.warmpawz.delivery.dto.tracking.LiveLocationDto;
import com.warmpawz.delivery.dto.tracking.RiderInfoDto;
import com.warmpawz.delivery.entity.DeliveryTracking;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class DeliveryTrackingEnrichmentService {

	private final PidgeTrackingEnrichmentProvider pidgeProvider;

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
		return pidgeProvider.fetchLiveEnrichment(externalId);
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
		return m;
	}

	private static Map<String, Object> locationToMap(LiveLocationDto location) {
		Map<String, Object> m = new LinkedHashMap<>();
		m.put("latitude", location.getLatitude());
		m.put("longitude", location.getLongitude());
		return m;
	}
}
