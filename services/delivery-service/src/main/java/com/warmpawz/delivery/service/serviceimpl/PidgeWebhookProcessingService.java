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
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * POST /webhooks/pidge — parity with monolith {@code logistics-webhooks.ts} Pidge handler (single source of truth in Java).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PidgeWebhookProcessingService {

	private static final Map<String, String> PIDGE_FULFILLMENT_STATUS_MAP = new HashMap<>();

	static {
		PIDGE_FULFILLMENT_STATUS_MAP.put("CANCELLED", "cancelled");
		PIDGE_FULFILLMENT_STATUS_MAP.put("CREATED", "awb_generated");
		PIDGE_FULFILLMENT_STATUS_MAP.put("OUT_FOR_PICKUP", "pickup_scheduled");
		PIDGE_FULFILLMENT_STATUS_MAP.put("REACHED_PICKUP", "pickup_scheduled");
		PIDGE_FULFILLMENT_STATUS_MAP.put("PICKED_UP", "picked_up");
		PIDGE_FULFILLMENT_STATUS_MAP.put("IN_TRANSIT", "in_transit");
		PIDGE_FULFILLMENT_STATUS_MAP.put("OUT_FOR_DELIVERY", "out_for_delivery");
		PIDGE_FULFILLMENT_STATUS_MAP.put("REACHED_DELIVERY", "out_for_delivery");
		PIDGE_FULFILLMENT_STATUS_MAP.put("DELIVERED", "delivered");
		PIDGE_FULFILLMENT_STATUS_MAP.put("DISPOSED", "delivered");
		PIDGE_FULFILLMENT_STATUS_MAP.put("UNDELIVERED", "out_for_delivery");
		PIDGE_FULFILLMENT_STATUS_MAP.put("RTO_OUT_FOR_DELIVERY", "rto_initiated");
		PIDGE_FULFILLMENT_STATUS_MAP.put("RTO_UNDELIVERED", "rto_initiated");
		PIDGE_FULFILLMENT_STATUS_MAP.put("RTO_DELIVERED", "returned");
		PIDGE_FULFILLMENT_STATUS_MAP.put("LOST", "lost");
		PIDGE_FULFILLMENT_STATUS_MAP.put("DAMAGED", "damaged");
	}

	private static final Map<String, String> PIDGE_PARENT_STATUS_MAP = Map.of(
			"pending", "pending",
			"fulfilled", "in_transit",
			"completed", "delivered",
			"cancelled", "cancelled");

	private final ShipmentRepository shipmentRepository;
	private final DeliveryTrackingRepository deliveryTrackingRepository;
	private final ShipmentTrackingEventRepository shipmentTrackingEventRepository;
	private final OrderStatusJdbcService orderStatusJdbc;
	private final JdbcTemplate jdbc;

	@Transactional
	public Map<String, Object> handlePidgePayload(JsonNode payload) {
		String pidgeId = payload.hasNonNull("id") ? payload.get("id").asText() : "";
		String referenceId = payload.hasNonNull("reference_id") ? payload.get("reference_id").asText() : "";
		if (pidgeId.isEmpty()) {
			return Map.of("error", "Missing id");
		}

		JsonNode fulfillment = payload.path("fulfillment");
		String ffStatus = fulfillment.hasNonNull("status")
				? fulfillment.get("status").asText().toUpperCase(Locale.ROOT)
				: "";
		String parentStatus = payload.hasNonNull("status")
				? payload.get("status").asText().toLowerCase(Locale.ROOT)
				: "";

		String normalized = normalizePidgeStatus(ffStatus, parentStatus);

		JsonNode logs = fulfillment.path("logs");
		JsonNode lastLog = logs.isArray() && logs.size() > 0 ? logs.get(logs.size() - 1) : null;
		JsonNode rider = fulfillment.has("rider") && !fulfillment.get("rider").isNull()
				? fulfillment.get("rider")
				: (lastLog != null && lastLog.has("rider") ? lastLog.get("rider") : null);
		JsonNode lastLocation = lastLog != null && lastLog.has("location") ? lastLog.get("location") : null;
		String trackCode = fulfillment.hasNonNull("track_code") ? fulfillment.get("track_code").asText() : null;

		Optional<Shipment> shipmentOpt = shipmentRepository
				.findFirstByLogisticsPartnerAndShipmentId("pidge", pidgeId);
		if (shipmentOpt.isEmpty() && referenceId != null && !referenceId.isEmpty()) {
			shipmentOpt = findShipmentByReference(referenceId);
		}

		if (shipmentOpt.isEmpty()) {
			return handleHyperlocalDeliveryTracking(
					pidgeId, normalized, trackCode, rider, lastLog, lastLocation);
		}

		return handleEcommerceShipment(
				shipmentOpt.get(), normalized, trackCode, rider, lastLog, lastLocation, ffStatus, parentStatus);
	}

	private Map<String, Object> handleHyperlocalDeliveryTracking(
			String pidgeId,
			String normalized,
			String trackCode,
			JsonNode rider,
			JsonNode lastLog,
			JsonNode lastLocation) {
		Optional<DeliveryTracking> trackingOpt = deliveryTrackingRepository
				.findFirstByLogisticsPartnerAndExternalTaskIdOrderByCreatedAtDesc("pidge", pidgeId);
		if (trackingOpt.isEmpty()) {
			log.warn("[PIDGE WEBHOOK] Shipment / delivery_tracking not found for pidgeId={}", pidgeId);
			return Map.of("success", true, "message", "Shipment not found, ignored");
		}

		DeliveryTracking dt = trackingOpt.get();
		String dtStatus = mapPidgeNormalizedToDeliveryTrackingStatus(normalized);
		String riderName = extractRiderName(rider);
		String riderPhone = extractRiderPhone(rider);

		dt.setStatus(dtStatus);
		if (trackCode != null && !trackCode.isBlank()) {
			dt.setTrackingUrl(trackCode);
		}
		if (riderName != null && !riderName.isBlank()) {
			dt.setDeliveryPersonName(riderName);
		}
		if (riderPhone != null && !riderPhone.isBlank()) {
			dt.setDeliveryPersonPhone(riderPhone);
		}
		if (lastLocation != null && lastLocation.has("latitude") && lastLocation.has("longitude")) {
			dt.setCurrentLat(BigDecimal.valueOf(lastLocation.get("latitude").asDouble()));
			dt.setCurrentLng(BigDecimal.valueOf(lastLocation.get("longitude").asDouble()));
		}
		if ("picked_up".equals(normalized)) {
			dt.setPickedUpAt(Instant.now());
		}
		if ("delivered".equals(normalized)) {
			dt.setDeliveredAt(Instant.now());
		}
		dt.setUpdatedAt(Instant.now());
		deliveryTrackingRepository.save(dt);

		UUID hyperlocalOrderId = dt.getPharmacyOrderId() != null
				? dt.getPharmacyOrderId()
				: dt.getMealOrderId();
		if (hyperlocalOrderId == null && dt.getSubscriptionDeliveryId() != null) {
			hyperlocalOrderId = orderStatusJdbc.resolveMealOrderIdForSubscriptionDelivery(dt.getSubscriptionDeliveryId());
		}

		String orderStatus = mapPidgeNormalizedToPharmacyMealOrderStatus(normalized);
		if (hyperlocalOrderId != null && orderStatus != null) {
			if (dt.getPharmacyOrderId() != null) {
				orderStatusJdbc.updatePharmacyOrderStatus(hyperlocalOrderId, orderStatus);
			} else {
				orderStatusJdbc.updateMealOrderStatus(hyperlocalOrderId, orderStatus);
				if ("delivered".equals(orderStatus)) {
					orderStatusJdbc.ensureMealOrderSettlementOnDelivered(hyperlocalOrderId);
				}
			}
		}

		return Map.of(
				"success", true,
				"message", "Pidge webhook processed (hyperlocal)",
				"deliveryTrackingId", dt.getId(),
				"status", normalized);
	}

	private Map<String, Object> handleEcommerceShipment(
			Shipment shipment,
			String normalized,
			String trackCode,
			JsonNode rider,
			JsonNode lastLog,
			JsonNode lastLocation,
			String ffStatus,
			String parentStatus) {
		String previousStatus = shipment.getStatus();
		String shipmentRowStatus = coercePidgeStatusForShipmentsTable(normalized);

		shipment.setStatus(shipmentRowStatus);
		if (trackCode != null && !trackCode.isBlank()) {
			shipment.setAwbCode(trackCode);
		}
		if (lastLocation != null && lastLocation.has("latitude") && lastLocation.has("longitude")) {
			shipment.setCurrentLocation(
					lastLocation.get("latitude").asDouble() + "," + lastLocation.get("longitude").asDouble());
		}
		if ("delivered".equals(normalized)) {
			shipment.setDeliveredAt(Instant.now());
		}
		if ("picked_up".equals(normalized)) {
			shipment.setPickedUpAt(Instant.now());
		}
		shipment.setUpdatedAt(Instant.now());
		shipmentRepository.save(shipment);

		ShipmentTrackingEvent ev = new ShipmentTrackingEvent();
		ev.setShipmentId(shipment.getId());
		String eventType = lastLog != null && lastLog.hasNonNull("status")
				? lastLog.get("status").asText()
				: (!ffStatus.isEmpty() ? ffStatus : parentStatus);
		ev.setEventType(eventType != null && !eventType.isEmpty() ? eventType : "update");
		String eventDesc = lastLog != null && lastLog.hasNonNull("remark")
				? lastLog.get("remark").asText()
				: (lastLog != null && lastLog.hasNonNull("status") ? lastLog.get("status").asText() : null);
		if (eventDesc == null || eventDesc.isBlank()) {
			eventDesc = !ffStatus.isEmpty() ? ffStatus : (!parentStatus.isEmpty() ? parentStatus : "update");
		}
		ev.setEventDescription(eventDesc);
		if (lastLocation != null && lastLocation.has("latitude") && lastLocation.has("longitude")) {
			ev.setLocation(
					lastLocation.get("latitude").asDouble() + "," + lastLocation.get("longitude").asDouble());
		}
		if (lastLog != null && lastLog.hasNonNull("timestamp")) {
			try {
				ev.setTimestamp(Instant.parse(lastLog.get("timestamp").asText()));
			} catch (Exception e) {
				ev.setTimestamp(Instant.now());
			}
		} else {
			ev.setTimestamp(Instant.now());
		}
		ev.setMetadata("{}");
		shipmentTrackingEventRepository.save(ev);

		if (shipment.getOrderId() != null) {
			try {
				orderStatusJdbc.updateEcommerceOrderShipmentStatus(shipment.getOrderId(), normalized);
			} catch (Exception e) {
				log.error("[PIDGE WEBHOOK] Error updating ecommerce order: {}", e.getMessage());
			}
			String riderSummary = buildRiderSummary(rider);
			orderStatusJdbc.maybeInsertShipmentCustomerNotification(
					shipment.getOrderId(),
					normalized,
					previousStatus,
					trackCode,
					riderSummary);
		}

		return Map.of(
				"success", true,
				"message", "Pidge webhook processed",
				"shipmentId", shipment.getId(),
				"status", normalized);
	}

	private Optional<Shipment> findShipmentByReference(String referenceId) {
		List<UUID> ids = jdbc.query(
				"""
						SELECT s.id FROM shipments s
						INNER JOIN orders o ON o.id = s.order_id
						WHERE s.logistics_partner = 'pidge'
						  AND (o.order_number = ? OR o.id::text = ? OR s.awb_code = ?)
						LIMIT 1
						""",
				(rs, i) -> rs.getObject(1, UUID.class),
				referenceId,
				referenceId,
				referenceId);
		if (ids.isEmpty()) {
			return Optional.empty();
		}
		return shipmentRepository.findById(ids.get(0));
	}

	private static String normalizePidgeStatus(String ffStatus, String parentStatus) {
		if (ffStatus != null && !ffStatus.isEmpty()) {
			String m = PIDGE_FULFILLMENT_STATUS_MAP.get(ffStatus);
			if (m != null) {
				return m;
			}
		}
		String p = PIDGE_PARENT_STATUS_MAP.get(parentStatus);
		return p != null ? p : "unknown";
	}

	private static String coercePidgeStatusForShipmentsTable(String status) {
		Set<String> allowed = Set.of(
				"created", "awb_generated", "picked_up", "in_transit", "delivered", "returned", "cancelled");
		if (allowed.contains(status)) {
			return status;
		}
		return switch (status) {
			case "pending" -> "created";
			case "pickup_scheduled" -> "awb_generated";
			case "out_for_delivery" -> "in_transit";
			case "unknown" -> "in_transit";
			case "rto_initiated" -> "returned";
			case "lost", "damaged" -> "cancelled";
			default -> "in_transit";
		};
	}

	private static String mapPidgeNormalizedToDeliveryTrackingStatus(String normalized) {
		return switch (normalized) {
			case "delivered" -> "delivered";
			case "picked_up" -> "picked_up";
			case "cancelled" -> "failed";
			case "in_transit", "out_for_delivery", "unknown" -> "on_the_way";
			default -> "heading_to_pickup";
		};
	}

	private static String mapPidgeNormalizedToPharmacyMealOrderStatus(String normalized) {
		return switch (normalized) {
			case "delivered" -> "delivered";
			case "picked_up" -> "picked_up";
			case "cancelled" -> "cancelled";
			case "in_transit", "out_for_delivery", "unknown" -> "on_the_way";
			case "awb_generated", "pickup_scheduled", "pending" -> "ready_for_pickup";
			default -> null;
		};
	}

	private static String extractRiderName(JsonNode rider) {
		if (rider == null || rider.isNull()) {
			return null;
		}
		return rider.hasNonNull("name") ? rider.get("name").asText() : null;
	}

	private static String extractRiderPhone(JsonNode rider) {
		if (rider == null || rider.isNull()) {
			return null;
		}
		if (rider.hasNonNull("mobile")) {
			return rider.get("mobile").asText();
		}
		if (rider.hasNonNull("phone")) {
			return rider.get("phone").asText();
		}
		return null;
	}

	private static String buildRiderSummary(JsonNode rider) {
		String name = extractRiderName(rider);
		String phone = extractRiderPhone(rider);
		if (name == null) {
			return null;
		}
		return phone != null ? name + " (" + phone + ")" : name;
	}
}
