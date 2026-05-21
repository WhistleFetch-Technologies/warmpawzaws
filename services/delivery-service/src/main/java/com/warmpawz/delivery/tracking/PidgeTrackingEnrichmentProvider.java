package com.warmpawz.delivery.tracking;

import com.fasterxml.jackson.databind.JsonNode;
import com.warmpawz.delivery.dto.tracking.DeliveryTrackingEnrichmentDto;
import com.warmpawz.delivery.dto.tracking.LiveLocationDto;
import com.warmpawz.delivery.dto.tracking.RiderInfoDto;
import com.warmpawz.delivery.service.PidgeIntegrationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * Normalizes Pidge GET …/fulfillment/tracking (and nested order payloads) into {@link DeliveryTrackingEnrichmentDto}.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PidgeTrackingEnrichmentProvider implements LogisticsTrackingEnrichmentProvider {

	static final String PROVIDER_ID = "pidge";

	private final PidgeIntegrationService pidgeIntegrationService;

	@Override
	public String providerId() {
		return PROVIDER_ID;
	}

	@Override
	public Optional<DeliveryTrackingEnrichmentDto> fetchLiveEnrichment(String externalTaskId) {
		String pidgeOrderId = externalTaskId != null ? externalTaskId.trim() : "";
		if (pidgeOrderId.isEmpty()) {
			return Optional.empty();
		}
		log.info("[PIDGE TRACKING] fetch start pidgeOrderId={}", pidgeOrderId);
		try {
			JsonNode raw = pidgeIntegrationService.getRiderFulfillmentTracking(pidgeOrderId);
			DeliveryTrackingEnrichmentDto dto = parseFulfillmentTracking(raw);
			if (dto == null) {
				log.info("[PIDGE TRACKING] no usable fields pidgeOrderId={}", pidgeOrderId);
				return Optional.empty();
			}
			log.info(
					"[PIDGE TRACKING] normalized pidgeOrderId={} riderName={} hasLocation={} etaMinutes={} providerStatus={}",
					pidgeOrderId,
					dto.getRider() != null ? dto.getRider().getRiderName() : null,
					dto.getLocation() != null,
					dto.getEtaMinutes(),
					dto.getProviderTrackingStatus());
			return Optional.of(dto);
		} catch (Exception e) {
			log.warn("[PIDGE TRACKING] fetch failed pidgeOrderId={} error={}", pidgeOrderId, e.getMessage());
			return Optional.empty();
		}
	}

	/** Package-visible for unit tests. */
	static DeliveryTrackingEnrichmentDto parseFulfillmentTracking(JsonNode raw) {
		if (raw == null || raw.isNull()) {
			return null;
		}
		JsonNode root = unwrapData(raw);
		JsonNode fulfillment = root.path("fulfillment");
		if (fulfillment.isMissingNode() || fulfillment.isNull()) {
			fulfillment = root;
		}

		JsonNode logs = fulfillment.path("logs");
		JsonNode lastLog = logs.isArray() && logs.size() > 0 ? logs.get(logs.size() - 1) : null;
		JsonNode rider = fulfillment.has("rider") && !fulfillment.get("rider").isNull()
				? fulfillment.get("rider")
				: (lastLog != null && lastLog.has("rider") ? lastLog.get("rider") : null);

		RiderInfoDto riderDto = buildRider(rider);
		LiveLocationDto location = resolveLocation(fulfillment, lastLog, rider);
		Integer eta = resolveEtaMinutes(fulfillment, lastLog);
		String providerStatus = textOrNull(fulfillment, "status");
		String trackingUrl = firstNonBlank(
				textOrNull(fulfillment, "track_code"),
				textOrNull(fulfillment, "tracking_url"),
				textOrNull(root, "tracking_url"));

		if (riderDto == null && location == null && eta == null && providerStatus == null && trackingUrl == null) {
			return null;
		}

		return DeliveryTrackingEnrichmentDto.builder()
				.provider(PROVIDER_ID)
				.rider(riderDto)
				.location(location)
				.etaMinutes(eta)
				.providerTrackingStatus(providerStatus)
				.trackingUrl(trackingUrl)
				.build();
	}

	private static JsonNode unwrapData(JsonNode raw) {
		if (raw.has("data") && raw.get("data").isObject()) {
			return raw.get("data");
		}
		return raw;
	}

	private static RiderInfoDto buildRider(JsonNode rider) {
		if (rider == null || rider.isNull()) {
			return null;
		}
		String name = textOrNull(rider, "name");
		String phone = firstNonBlank(textOrNull(rider, "mobile"), textOrNull(rider, "phone"));
		String riderId = firstNonBlank(textOrNull(rider, "id"), textOrNull(rider, "rider_id"));
		String vehicleType = firstNonBlank(
				textOrNull(rider, "vehicle_type"),
				textOrNull(rider, "vehicleType"),
				textOrNull(rider, "vehicle"));
		String vehicleNumber = firstNonBlank(
				textOrNull(rider, "vehicle_number"),
				textOrNull(rider, "vehicleNumber"),
				textOrNull(rider, "registration_number"));

		if (isBlank(name) && isBlank(phone) && isBlank(riderId) && isBlank(vehicleType) && isBlank(vehicleNumber)) {
			return null;
		}
		return RiderInfoDto.builder()
				.riderName(name)
				.riderPhone(phone)
				.riderId(riderId)
				.vehicleType(vehicleType)
				.vehicleNumber(vehicleNumber)
				.build();
	}

	private static LiveLocationDto resolveLocation(JsonNode fulfillment, JsonNode lastLog, JsonNode rider) {
		Double lat = null;
		Double lng = null;

		JsonNode loc = lastLog != null && lastLog.has("location") ? lastLog.get("location") : null;
		if (loc != null && !loc.isNull()) {
			lat = readCoord(loc, "latitude", "lat");
			lng = readCoord(loc, "longitude", "lng", "lon");
		}

		if (lat == null && rider != null && rider.has("current_latitude")) {
			lat = readCoord(rider, "current_latitude", "latitude", "lat");
			lng = readCoord(rider, "current_longitude", "longitude", "lng", "lon");
		}

		if (lat == null && fulfillment.has("location")) {
			JsonNode fLoc = fulfillment.get("location");
			lat = readCoord(fLoc, "latitude", "lat");
			lng = readCoord(fLoc, "longitude", "lng", "lon");
		}

		if (lat == null || lng == null || !isValidCoord(lat, lng)) {
			return null;
		}
		return LiveLocationDto.builder().latitude(lat).longitude(lng).build();
	}

	private static Integer resolveEtaMinutes(JsonNode fulfillment, JsonNode lastLog) {
		Integer eta = readInt(fulfillment, "eta_minutes", "etaMinutes", "eta_to_delivery_minutes");
		if (eta != null) {
			return eta;
		}
		if (lastLog != null) {
			eta = readInt(lastLog, "eta_minutes", "etaMinutes", "eta");
		}
		if (eta != null) {
			return eta;
		}
		JsonNode etaNode = fulfillment.get("eta");
		if (etaNode != null && etaNode.isNumber()) {
			return etaNode.intValue();
		}
		return null;
	}

	private static Double readCoord(JsonNode node, String... keys) {
		for (String key : keys) {
			if (node != null && node.has(key) && node.get(key).isNumber()) {
				double v = node.get(key).asDouble();
				if (Double.isFinite(v)) {
					return v;
				}
			}
		}
		return null;
	}

	private static Integer readInt(JsonNode node, String... keys) {
		for (String key : keys) {
			if (node != null && node.has(key) && node.get(key).isNumber()) {
				int v = node.get(key).asInt();
				if (v >= 0) {
					return v;
				}
			}
		}
		return null;
	}

	private static boolean isValidCoord(double lat, double lng) {
		return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && !(lat == 0 && lng == 0);
	}

	private static String textOrNull(JsonNode node, String field) {
		if (node == null || node.isNull() || !node.has(field) || node.get(field).isNull()) {
			return null;
		}
		String t = node.get(field).asText().trim();
		return t.isEmpty() ? null : t;
	}

	private static String firstNonBlank(String... values) {
		for (String v : values) {
			if (v != null && !v.isBlank()) {
				return v;
			}
		}
		return null;
	}

	private static boolean isBlank(String s) {
		return s == null || s.isBlank();
	}
}
