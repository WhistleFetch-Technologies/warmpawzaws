package com.warmpawz.delivery.service.serviceimpl;

import com.fasterxml.jackson.databind.JsonNode;
import com.warmpawz.delivery.entity.DeliveryTracking;
import com.warmpawz.delivery.entity.Shipment;
import com.warmpawz.delivery.entity.ShipmentTrackingEvent;
import com.warmpawz.delivery.repository.DeliveryTrackingRepository;
import com.warmpawz.delivery.repository.ShipmentRepository;
import com.warmpawz.delivery.repository.ShipmentTrackingEventRepository;
import com.warmpawz.delivery.service.OrderStatusJdbcService;
import com.warmpawz.delivery.service.PidgePartialDeliverySupport;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
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
	private final ObjectMapper objectMapper;
	private final PidgeTicketWebhookProcessingService pidgeTicketWebhookProcessingService;
	private final PidgePartialDeliveryWebhookService pidgePartialDeliveryWebhookService;

	/** Pidge Communications Module — Rider Active Task webhook (batch rider + order_details). */
	static boolean isRiderTaskPayload(JsonNode payload) {
		if (payload == null || !payload.isObject()) {
			return false;
		}
		JsonNode details = payload.get("order_details");
		return details != null && details.isArray() && payload.has("rider");
	}

	@Transactional
	public Map<String, Object> handlePidgePayload(JsonNode payload) {
		if (isRiderTaskPayload(payload)) {
			return handleRiderTaskPayload(payload);
		}
		if (PidgeTicketWebhookProcessingService.isTicketStatusPayload(payload)) {
			return pidgeTicketWebhookProcessingService.handleTicketStatusPayload(payload);
		}

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

		Optional<Map<String, Object>> returnLeg = pidgePartialDeliveryWebhookService.tryHandleReturnOrderWebhook(
				pidgeId, ffStatus, payload);
		if (returnLeg.isPresent()) {
			return returnLeg.get();
		}

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
					payload, pidgeId, referenceId, normalized, trackCode, rider, lastLog, lastLocation);
		}

		return handleEcommerceShipment(
				payload, shipmentOpt.get(), normalized, trackCode, rider, lastLog, lastLocation, ffStatus, parentStatus);
	}

	private Map<String, Object> handleHyperlocalDeliveryTracking(
			JsonNode payload,
			String pidgeId,
			String referenceId,
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
		if ("delivered".equals(normalized) && PidgePartialDeliverySupport.hasReturnOrderInfo(payload)) {
			return pidgePartialDeliveryWebhookService.handleForwardDeliveredWithReturn(
					payload, pidgeId, referenceId, dt, null);
		}

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
			JsonNode payload,
			Shipment shipment,
			String normalized,
			String trackCode,
			JsonNode rider,
			JsonNode lastLog,
			JsonNode lastLocation,
			String ffStatus,
			String parentStatus) {
		if ("delivered".equals(normalized) && PidgePartialDeliverySupport.hasReturnOrderInfo(payload)) {
			return pidgePartialDeliveryWebhookService.handleForwardDeliveredWithReturn(
					payload, shipment.getShipmentId(), shipment.getAwbCode(), null, shipment);
		}

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

	/**
	 * Pidge Rider Task Webhook (Communications Module): live rider location + per-order ETAs/statuses.
	 * Orders drop out of {@code order_details} once delivered.
	 */
	@Transactional
	public Map<String, Object> handleRiderTaskPayload(JsonNode payload) {
		JsonNode rider = payload.path("rider");
		String riderName = extractRiderName(rider);
		String riderPhone = extractRiderPhone(rider);
		BigDecimal riderLat = rider.has("current_latitude")
				? BigDecimal.valueOf(rider.get("current_latitude").asDouble())
				: null;
		BigDecimal riderLng = rider.has("current_longitude")
				? BigDecimal.valueOf(rider.get("current_longitude").asDouble())
				: null;
		String updateSource = payload.hasNonNull("update_source") ? payload.get("update_source").asText() : null;
		long eventTimestamp = payload.has("event_timestamp") ? payload.get("event_timestamp").asLong() : 0L;

		JsonNode orderDetails = payload.get("order_details");
		int processed = 0;
		int skipped = 0;
		List<String> deliveryTrackingIds = new ArrayList<>();

		for (JsonNode detail : orderDetails) {
			Optional<DeliveryTracking> trackingOpt = resolveTrackingForRiderTaskOrder(detail);
			if (trackingOpt.isEmpty()) {
				log.warn(
						"[PIDGE RIDER TASK] delivery_tracking not found ref={} order_id={} fulfillment_id={}",
						textOrNull(detail, "reference_id"),
						detail.has("order_id") ? detail.get("order_id").asText() : null,
						textOrNull(detail, "id"));
				skipped++;
				continue;
			}
			applyRiderTaskOrderDetail(
					trackingOpt.get(),
					detail,
					riderName,
					riderPhone,
					riderLat,
					riderLng,
					updateSource,
					eventTimestamp);
			processed++;
			deliveryTrackingIds.add(trackingOpt.get().getId().toString());
		}

		Map<String, Object> out = new HashMap<>();
		out.put("success", true);
		out.put("message", "Pidge rider task webhook processed");
		out.put("type", "rider_task");
		out.put("processed", processed);
		out.put("skipped", skipped);
		out.put("deliveryTrackingIds", deliveryTrackingIds);
		return out;
	}

	private Optional<DeliveryTracking> resolveTrackingForRiderTaskOrder(JsonNode detail) {
		String fulfillmentId = textOrNull(detail, "id");
		if (fulfillmentId != null && !fulfillmentId.isBlank()) {
			Optional<DeliveryTracking> byFf = deliveryTrackingRepository
					.findFirstByLogisticsPartnerAndExternalTaskIdOrderByCreatedAtDesc("pidge", fulfillmentId.trim());
			if (byFf.isPresent()) {
				return byFf;
			}
		}
		if (detail.has("order_id") && !detail.get("order_id").isNull()) {
			String pidgeOrderId = detail.get("order_id").asText().trim();
			if (!pidgeOrderId.isEmpty()) {
				Optional<DeliveryTracking> byOrder = deliveryTrackingRepository
						.findFirstByLogisticsPartnerAndExternalTaskIdOrderByCreatedAtDesc("pidge", pidgeOrderId);
				if (byOrder.isPresent()) {
					return byOrder;
				}
				List<UUID> mealByPidgeCol = jdbc.query(
						"""
								SELECT dt.id FROM delivery_tracking dt
								INNER JOIN meal_orders mo ON mo.id = dt.meal_order_id
								WHERE dt.logistics_partner = 'pidge'
								  AND mo.pidge_order_id = ?
								ORDER BY dt.created_at DESC
								LIMIT 1
								""",
						(rs, i) -> rs.getObject("id", UUID.class),
						pidgeOrderId);
				if (!mealByPidgeCol.isEmpty()) {
					return deliveryTrackingRepository.findById(mealByPidgeCol.get(0));
				}
			}
		}
		String referenceId = textOrNull(detail, "reference_id");
		if (referenceId != null && !referenceId.isBlank()) {
			return resolveTrackingByReferenceId(referenceId.trim());
		}
		return Optional.empty();
	}

	private Optional<DeliveryTracking> resolveTrackingByReferenceId(String referenceId) {
		List<UUID> ids = jdbc.query(
				"""
						SELECT dt.id FROM delivery_tracking dt
						LEFT JOIN meal_orders mo ON mo.id = dt.meal_order_id
						LEFT JOIN pharmacy_orders po ON po.id = dt.pharmacy_order_id
						WHERE dt.logistics_partner = 'pidge'
						  AND (
						    mo.id::text = ? OR mo.order_number = ?
						    OR po.id::text = ? OR po.order_number = ?
						  )
						ORDER BY dt.created_at DESC
						LIMIT 1
						""",
				(rs, i) -> rs.getObject(1, UUID.class),
				referenceId,
				referenceId,
				referenceId,
				referenceId);
		if (ids.isEmpty()) {
			return Optional.empty();
		}
		return deliveryTrackingRepository.findById(ids.get(0));
	}

	private void applyRiderTaskOrderDetail(
			DeliveryTracking dt,
			JsonNode detail,
			String riderName,
			String riderPhone,
			BigDecimal riderLat,
			BigDecimal riderLng,
			String updateSource,
			long eventTimestamp) {
		String ffStatus = detail.hasNonNull("status")
				? detail.get("status").asText().toUpperCase(Locale.ROOT)
				: "";
		String normalized = normalizePidgeStatus(ffStatus, "");

		if (riderName != null && !riderName.isBlank()) {
			dt.setDeliveryPersonName(riderName);
		}
		if (riderPhone != null && !riderPhone.isBlank()) {
			dt.setDeliveryPersonPhone(riderPhone);
		}
		if (riderLat != null && riderLng != null) {
			dt.setCurrentLat(riderLat);
			dt.setCurrentLng(riderLng);
			dt.setLastLocationUpdate(Instant.now());
		}

		String pickupEtaIso = detail.hasNonNull("estimated_pickup_time")
				? detail.get("estimated_pickup_time").asText()
				: null;
		String dropEtaIso = detail.hasNonNull("estimated_drop_time")
				? detail.get("estimated_drop_time").asText()
				: null;
		Integer pickupMins = minutesUntilIso(pickupEtaIso);
		Integer dropMins = minutesUntilIso(dropEtaIso);
		if (pickupMins != null) {
			dt.setEtaToPickupMinutes(pickupMins);
		}
		if (dropMins != null) {
			dt.setEtaToDeliveryMinutes(dropMins);
		}

		String dtStatus = mapPidgeNormalizedToDeliveryTrackingStatus(normalized);
		dt.setStatus(dtStatus);
		if ("picked_up".equals(normalized) && dt.getPickedUpAt() == null) {
			dt.setPickedUpAt(Instant.now());
		}
		if ("delivered".equals(normalized)) {
			dt.setDeliveredAt(Instant.now());
		}
		dt.setMetadataJson(mergeRiderTaskMetadata(dt.getMetadataJson(), detail, updateSource, eventTimestamp));
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
	}

	private String mergeRiderTaskMetadata(
			String existingJson, JsonNode detail, String updateSource, long eventTimestamp) {
		ObjectNode root;
		try {
			root = existingJson == null || existingJson.isBlank()
					? objectMapper.createObjectNode()
					: (ObjectNode) objectMapper.readTree(existingJson);
		} catch (Exception e) {
			root = objectMapper.createObjectNode();
		}
		ObjectNode task = objectMapper.createObjectNode();
		if (detail.has("route_id") && !detail.get("route_id").isNull()) {
			task.put("route_id", detail.get("route_id").asLong());
		}
		putTextIfPresent(task, "reference_id", textOrNull(detail, "reference_id"));
		putTextIfPresent(task, "fulfillment_id", textOrNull(detail, "id"));
		if (detail.has("order_id") && !detail.get("order_id").isNull()) {
			task.put("order_id", detail.get("order_id").asLong());
		}
		putTextIfPresent(task, "status", textOrNull(detail, "status"));
		putTextIfPresent(task, "attempt_type", textOrNull(detail, "attempt_type"));
		if (detail.has("estimated_pickup_time") && !detail.get("estimated_pickup_time").isNull()) {
			task.put("estimated_pickup_time", detail.get("estimated_pickup_time").asText());
		} else {
			task.putNull("estimated_pickup_time");
		}
		if (detail.has("estimated_drop_time") && !detail.get("estimated_drop_time").isNull()) {
			task.put("estimated_drop_time", detail.get("estimated_drop_time").asText());
		} else {
			task.putNull("estimated_drop_time");
		}
		if (updateSource != null) {
			task.put("update_source", updateSource);
		}
		if (eventTimestamp > 0) {
			task.put("event_timestamp", eventTimestamp);
		}
		task.put("received_at", Instant.now().toString());
		root.set("pidge_rider_task", task);
		try {
			return objectMapper.writeValueAsString(root);
		} catch (Exception e) {
			return root.toString();
		}
	}

	private static void putTextIfPresent(ObjectNode node, String field, String value) {
		if (value != null && !value.isBlank()) {
			node.put(field, value);
		}
	}

	private static String textOrNull(JsonNode node, String field) {
		return node != null && node.hasNonNull(field) ? node.get(field).asText() : null;
	}

	private static Integer minutesUntilIso(String iso) {
		if (iso == null || iso.isBlank()) {
			return null;
		}
		try {
			Instant target = Instant.parse(iso);
			long mins = Duration.between(Instant.now(), target).toMinutes();
			return (int) Math.max(0, mins);
		} catch (Exception e) {
			return null;
		}
	}
}
