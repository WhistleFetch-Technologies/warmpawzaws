package com.warmpawz.delivery.service.serviceimpl;

import com.fasterxml.jackson.databind.JsonNode;
import com.warmpawz.delivery.entity.DeliveryTracking;
import com.warmpawz.delivery.entity.Shipment;
import com.warmpawz.delivery.entity.ShipmentTrackingEvent;
import com.warmpawz.delivery.repository.DeliveryTrackingRepository;
import com.warmpawz.delivery.repository.ShipmentRepository;
import com.warmpawz.delivery.repository.ShipmentTrackingEventRepository;
import com.warmpawz.delivery.service.OrderStatusJdbcService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * POST /webhooks/pidge processing (subset of Lambda {@code logistics-webhooks.ts}).
 */
@Service
@RequiredArgsConstructor
public class PidgeWebhookProcessingService {

	private final ShipmentRepository shipmentRepository;
	private final DeliveryTrackingRepository deliveryTrackingRepository;
	private final ShipmentTrackingEventRepository shipmentTrackingEventRepository;
	private final OrderStatusJdbcService orderStatusJdbc;

	@Transactional
	public Map<String, Object> handlePidgePayload(JsonNode payload) {
		String pidgeId = payload.hasNonNull("id") ? payload.get("id").asText() : "";
		String referenceId = payload.hasNonNull("reference_id") ? payload.get("reference_id").asText() : "";
		if (pidgeId.isEmpty()) {
			return Map.of("error", "Missing id");
		}

		JsonNode fulfillment = payload.path("fulfillment");
		String ffStatus = fulfillment.hasNonNull("status") ? fulfillment.get("status").asText().toUpperCase(Locale.ROOT) : "";
		String parentStatus = payload.hasNonNull("status") ? payload.get("status").asText().toLowerCase(Locale.ROOT) : "";

		String normalized = mapFulfillmentOrParent(ffStatus, parentStatus);

		Optional<Shipment> shipmentOpt = shipmentRepository
				.findFirstByLogisticsPartnerAndShipmentId("pidge", pidgeId);
		if (shipmentOpt.isEmpty() && referenceId != null && !referenceId.isEmpty()) {
			try {
				UUID oid = UUID.fromString(referenceId);
				List<Shipment> byOrder = shipmentRepository.findByOrderId(oid);
				shipmentOpt = byOrder.stream().filter(s -> "pidge".equals(s.getLogisticsPartner())).findFirst();
			} catch (IllegalArgumentException ignored) {
			}
		}

		Optional<DeliveryTracking> trackingOpt = deliveryTrackingRepository
				.findFirstByExternalTaskIdAndLogisticsPartner(pidgeId, "pidge");

		if (trackingOpt.isPresent()) {
			DeliveryTracking dt = trackingOpt.get();
			String dtStatus = toDeliveryTrackingStatus(normalized);
			dt.setStatus(dtStatus);
			if (fulfillment.hasNonNull("track_code")) {
				dt.setTrackingUrl(fulfillment.get("track_code").asText());
			}
			dt.setUpdatedAt(Instant.now());
			deliveryTrackingRepository.save(dt);
			if (dt.getPharmacyOrderId() != null) {
				String os = toPharmacyMealOrderStatus(normalized);
				if (os != null) {
					orderStatusJdbc.updatePharmacyOrderStatus(dt.getPharmacyOrderId(), os);
				}
			} else if (dt.getMealOrderId() != null) {
				String os = toPharmacyMealOrderStatus(normalized);
				if (os != null) {
					orderStatusJdbc.updateMealOrderStatus(dt.getMealOrderId(), os);
				}
			}
			return Map.of("success", true, "message", "Pidge webhook processed (hyperlocal)", "deliveryTrackingId", dt.getId(), "status", normalized);
		}

		if (shipmentOpt.isPresent()) {
			Shipment s = shipmentOpt.get();
			String shipmentStatus = coerceForShipmentTable(normalized);
			s.setStatus(shipmentStatus);
			s.setAwbCode(fulfillment.hasNonNull("track_code") ? fulfillment.get("track_code").asText() : s.getAwbCode());
			if ("delivered".equals(normalized)) {
				s.setDeliveredAt(Instant.now());
			}
			if ("picked_up".equals(normalized)) {
				s.setPickedUpAt(Instant.now());
			}
			s.setUpdatedAt(Instant.now());
			shipmentRepository.save(s);

			ShipmentTrackingEvent ev = new ShipmentTrackingEvent();
			ev.setShipmentId(s.getId());
			ev.setEventType(ffStatus.isEmpty() ? parentStatus : ffStatus);
			ev.setEventDescription("Pidge webhook");
			ev.setTimestamp(Instant.now());
			ev.setMetadata("{}");
			shipmentTrackingEventRepository.save(ev);

			return Map.of("success", true, "message", "Pidge webhook processed", "shipmentId", s.getId());
		}

		return Map.of("success", true, "message", "Shipment not found, ignored");
	}

	private static String mapFulfillmentOrParent(String ff, String parent) {
		String n = mapFf(ff);
		if (!"unknown".equals(n)) {
			return n;
		}
		return switch (parent) {
			case "pending" -> "pending";
			case "fulfilled" -> "in_transit";
			case "completed" -> "delivered";
			case "cancelled" -> "cancelled";
			default -> "unknown";
		};
	}

	private static String mapFf(String ff) {
		if (ff == null || ff.isEmpty()) {
			return "unknown";
		}
		return switch (ff) {
			case "CANCELLED" -> "cancelled";
			case "CREATED" -> "awb_generated";
			case "OUT_FOR_PICKUP", "REACHED_PICKUP" -> "pickup_scheduled";
			case "PICKED_UP" -> "picked_up";
			case "IN_TRANSIT" -> "in_transit";
			case "OUT_FOR_DELIVERY", "REACHED_DELIVERY", "UNDELIVERED" -> "out_for_delivery";
			case "DELIVERED", "DISPOSED" -> "delivered";
			case "RTO_OUT_FOR_DELIVERY", "RTO_UNDELIVERED" -> "rto_initiated";
			case "RTO_DELIVERED" -> "returned";
			case "LOST" -> "lost";
			case "DAMAGED" -> "damaged";
			default -> "unknown";
		};
	}

	private static String coerceForShipmentTable(String normalized) {
		Set<String> allowed = Set.of("created", "awb_generated", "picked_up", "in_transit", "delivered", "returned", "cancelled");
		if (allowed.contains(normalized)) {
			return normalized;
		}
		return switch (normalized) {
			case "pending" -> "created";
			case "pickup_scheduled" -> "awb_generated";
			case "out_for_delivery" -> "in_transit";
			case "unknown" -> "in_transit";
			case "rto_initiated" -> "returned";
			case "lost", "damaged" -> "cancelled";
			default -> "in_transit";
		};
	}

	private static String toDeliveryTrackingStatus(String normalized) {
		return switch (normalized) {
			case "delivered" -> "delivered";
			case "picked_up" -> "picked_up";
			case "cancelled" -> "failed";
			case "in_transit", "out_for_delivery", "unknown" -> "on_the_way";
			default -> "heading_to_pickup";
		};
	}

	private static String toPharmacyMealOrderStatus(String normalized) {
		return switch (normalized) {
			case "delivered" -> "delivered";
			case "picked_up" -> "picked_up";
			case "cancelled" -> "cancelled";
			case "in_transit", "out_for_delivery", "unknown" -> "on_the_way";
			case "awb_generated", "pickup_scheduled", "pending" -> "ready_for_pickup";
			default -> null;
		};
	}
}
