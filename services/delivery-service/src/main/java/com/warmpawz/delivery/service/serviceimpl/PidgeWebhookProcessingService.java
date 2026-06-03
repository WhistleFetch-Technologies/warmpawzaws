package com.warmpawz.delivery.service.serviceimpl;

import com.fasterxml.jackson.databind.JsonNode;
import com.warmpawz.delivery.entity.DeliveryTracking;
import com.warmpawz.delivery.entity.Shipment;
import com.warmpawz.delivery.entity.ShipmentTrackingEvent;
import com.warmpawz.delivery.repository.DeliveryTrackingRepository;
import com.warmpawz.delivery.repository.ShipmentRepository;
import com.warmpawz.delivery.repository.ShipmentTrackingEventRepository;
import com.warmpawz.delivery.service.MealDeliveryNotificationService;
import com.warmpawz.delivery.service.OrderStatusJdbcService;
import com.warmpawz.delivery.service.MealRefundCaseBridgeService;
import com.warmpawz.delivery.service.PidgeMealCancellationService;
import com.warmpawz.delivery.service.PidgeMealCancellationService.MealCancelOutcome;
import com.warmpawz.delivery.service.PidgeMealCancellationService.MealCancelProcessResult;
import com.warmpawz.delivery.service.PidgeMealCancellationSupport;
import com.warmpawz.delivery.service.PidgePartialDeliverySupport;
import com.warmpawz.delivery.service.DeliveryLocationHistoryWriter;
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
		PIDGE_FULFILLMENT_STATUS_MAP.put("PLACED", "pending");
		PIDGE_FULFILLMENT_STATUS_MAP.put("MANIFESTED", "pickup_scheduled");
		PIDGE_FULFILLMENT_STATUS_MAP.put("OUT_FOR_PICKUP", "pickup_scheduled");
		PIDGE_FULFILLMENT_STATUS_MAP.put("REACHED_PICKUP", "pickup_scheduled");
		PIDGE_FULFILLMENT_STATUS_MAP.put("PICKED_UP", "picked_up");
		PIDGE_FULFILLMENT_STATUS_MAP.put("IN_TRANSIT", "in_transit");
		PIDGE_FULFILLMENT_STATUS_MAP.put("OUT_FOR_DELIVERY", "out_for_delivery");
		PIDGE_FULFILLMENT_STATUS_MAP.put("REACHED_DELIVERY", "nearby");
		PIDGE_FULFILLMENT_STATUS_MAP.put("DELIVERED", "delivered");
		PIDGE_FULFILLMENT_STATUS_MAP.put("DISPOSED", "delivered");
		PIDGE_FULFILLMENT_STATUS_MAP.put("UNDELIVERED", "out_for_delivery");
		PIDGE_FULFILLMENT_STATUS_MAP.put("RTO_OUT_FOR_DELIVERY", "rto_initiated");
		PIDGE_FULFILLMENT_STATUS_MAP.put("RTO_UNDELIVERED", "rto_initiated");
		PIDGE_FULFILLMENT_STATUS_MAP.put("RTO_DELIVERED", "returned");
		PIDGE_FULFILLMENT_STATUS_MAP.put("LOST", "lost");
		PIDGE_FULFILLMENT_STATUS_MAP.put("DAMAGED", "damaged");
	}

	/**
	 * Parent / sandbox order-level semantic (lowercase keys). Note: bare {@code fulfilled} is handled in
	 * {@link #resolvePidgeStatus(String, String, String)} after composite {@code fulfilled|…} checks so
	 * {@code fulfilled|delivered} never degrades to generic in_transit.
	 * <p>Smart Allocation may send {@code placed} / {@code manifested} on the parent {@code status} field.
	 */
	private static final Map<String, String> PIDGE_PARENT_STATUS_MAP = new HashMap<>();

	static {
		PIDGE_PARENT_STATUS_MAP.put("pending", "pending");
		PIDGE_PARENT_STATUS_MAP.put("placed", "pending");
		PIDGE_PARENT_STATUS_MAP.put("manifested", "pickup_scheduled");
		PIDGE_PARENT_STATUS_MAP.put("completed", "delivered");
		PIDGE_PARENT_STATUS_MAP.put("cancelled", "cancelled");
	}

	private final ShipmentRepository shipmentRepository;
	private final DeliveryTrackingRepository deliveryTrackingRepository;
	private final ShipmentTrackingEventRepository shipmentTrackingEventRepository;
	private final OrderStatusJdbcService orderStatusJdbc;
	private final JdbcTemplate jdbc;
	private final ObjectMapper objectMapper;
	private final PidgeTicketWebhookProcessingService pidgeTicketWebhookProcessingService;
	private final PidgePartialDeliveryWebhookService pidgePartialDeliveryWebhookService;
	private final DeliveryLocationHistoryWriter deliveryLocationHistoryWriter;
	private final MealDeliveryNotificationService mealDeliveryNotificationService;
	private final PidgeMealCancellationService pidgeMealCancellationService;
	private final MealRefundCaseBridgeService mealRefundCaseBridgeService;

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
		String rawFfStatus = fulfillment.hasNonNull("status") ? fulfillment.get("status").asText() : "";
		String ffStatus = rawFfStatus.isEmpty() ? "" : rawFfStatus.toUpperCase(Locale.ROOT);
		String parentStatus = payload.hasNonNull("status")
				? payload.get("status").asText().toLowerCase(Locale.ROOT)
				: "";
		String dummyStatus = payload.hasNonNull("dummy_status") ? payload.get("dummy_status").asText() : "";

		PidgeStatusResolution resolved = resolvePidgeStatus(rawFfStatus, parentStatus, dummyStatus);
		String normalized = resolved.normalized();
		log.info(
				"[PIDGE WEBHOOK] status_resolve pidgeId={} incomingDummyStatus={} rawFulfillmentStatus={} parentStatus={} compositeKey={} normalizedInternal={}",
				pidgeId,
				dummyStatus,
				rawFfStatus,
				parentStatus,
				resolved.compositeKey(),
				normalized);

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
					payload, pidgeId, referenceId, parentStatus, normalized, trackCode, rider, lastLog, lastLocation);
		}

		return handleEcommerceShipment(
				payload, shipmentOpt.get(), normalized, trackCode, rider, lastLog, lastLocation, ffStatus, parentStatus);
	}

	private Map<String, Object> handleHyperlocalDeliveryTracking(
			JsonNode payload,
			String pidgeId,
			String referenceId,
			String parentStatus,
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

		String rawFulfillmentStatus = payload.path("fulfillment").path("status").asText("");
		String dummyStatus = payload.hasNonNull("dummy_status") ? payload.get("dummy_status").asText() : "";

		if ("placed".equals(parentStatus) || "manifested".equals(parentStatus)) {
			log.info(
					"[PIDGE WEBHOOK] parent_status_mapping pidgeOrderId={} parentStatus={} resolvedInternalStatus={} previousTrackingStatus={}",
					pidgeId,
					parentStatus,
					normalized,
					dt.getStatus());
		}
		if ("delivered".equals(normalized) && PidgePartialDeliverySupport.hasReturnOrderInfo(payload)) {
			return pidgePartialDeliveryWebhookService.handleForwardDeliveredWithReturn(
					payload, pidgeId, referenceId, dt, null);
		}

		String dtStatus = mapPidgeNormalizedToDeliveryTrackingStatus(normalized);
		String riderName = extractRiderName(rider);
		String riderPhone = extractRiderPhone(rider);
		String riderPhoto = extractRiderPhoto(rider);

		boolean trackingDowngradeBlocked =
				"delivered".equalsIgnoreCase(dt.getStatus()) && !"delivered".equalsIgnoreCase(dtStatus);
		if (trackingDowngradeBlocked) {
			log.info(
					"[PIDGE WEBHOOK] skip_tracking_status_downgrade deliveryTrackingId={} keepingDbStatus=delivered attemptedNormalized={}",
					dt.getId(),
					normalized);
		} else {
			dt.setStatus(dtStatus);
			if ("picked_up".equals(normalized)) {
				dt.setPickedUpAt(Instant.now());
			}
			if ("delivered".equals(normalized)) {
				dt.setDeliveredAt(Instant.now());
			}
		}
		if (trackCode != null && !trackCode.isBlank()) {
			dt.setTrackingUrl(trackCode);
		}
		if (riderName != null && !riderName.isBlank()) {
			dt.setDeliveryPersonName(riderName);
		}
		if (riderPhone != null && !riderPhone.isBlank()) {
			dt.setDeliveryPersonPhone(riderPhone);
		}
		if (riderPhoto != null && !riderPhoto.isBlank()) {
			dt.setDeliveryPersonPhoto(riderPhoto);
		}
		if (lastLocation != null && lastLocation.has("latitude") && lastLocation.has("longitude")) {
			BigDecimal lat = BigDecimal.valueOf(lastLocation.get("latitude").asDouble());
			BigDecimal lng = BigDecimal.valueOf(lastLocation.get("longitude").asDouble());
			persistHyperlocalGps(dt, lat, lng, Instant.now());
		}
		dt.setUpdatedAt(Instant.now());
		deliveryTrackingRepository.save(dt);

		UUID hyperlocalOrderId = dt.getPharmacyOrderId() != null
				? dt.getPharmacyOrderId()
				: dt.getMealOrderId();
		if (hyperlocalOrderId == null && dt.getSubscriptionDeliveryId() != null) {
			hyperlocalOrderId = orderStatusJdbc.resolveMealOrderIdForSubscriptionDelivery(dt.getSubscriptionDeliveryId());
		}

		MealCancelProcessResult mealCancelResult = MealCancelProcessResult.NOT_APPLICABLE;
		UUID mealCancelWebhookEventId = null;
		String mealCancellationReason = null;
		boolean isMealHyperlocal = dt.getPharmacyOrderId() == null && hyperlocalOrderId != null;
		if (isMealHyperlocal && "cancelled".equalsIgnoreCase(normalized)) {
			MealCancelOutcome mealCancelOutcome = pidgeMealCancellationService.tryProcessMealCancellation(
					hyperlocalOrderId,
					dt.getId(),
					pidgeId,
					normalized,
					parentStatus,
					rawFulfillmentStatus,
					dummyStatus,
					lastLog,
					payload);
			mealCancelResult = mealCancelOutcome.result();
			mealCancelWebhookEventId = mealCancelOutcome.webhookEventId();
			if (mealCancelResult == MealCancelProcessResult.APPLIED) {
				mealCancellationReason = PidgeMealCancellationSupport.extractCancellationReason(
						parentStatus, rawFulfillmentStatus, dummyStatus, lastLog);
				try {
					mealRefundCaseBridgeService.dispatchRefundCaseOnPidgeCancel(
							hyperlocalOrderId,
							pidgeId,
							mealCancellationReason,
							mealCancelWebhookEventId);
				} catch (Exception e) {
					log.warn("[PIDGE WEBHOOK] meal refund case bridge failed: {}", e.getMessage());
				}
			}
		}

		if (mealCancelResult == MealCancelProcessResult.DUPLICATE) {
			log.info(
					"[PIDGE WEBHOOK] idempotent_duplicate_cancel pidgeId={} mealOrderId={}",
					pidgeId,
					hyperlocalOrderId);
			return Map.of(
					"success", true,
					"message", "Pidge meal cancel webhook duplicate (idempotent)",
					"deliveryTrackingId", dt.getId(),
					"status", normalized,
					"duplicate", true);
		}

		String orderStatus = mapPidgeNormalizedToPharmacyMealOrderStatus(normalized);
		if (!trackingDowngradeBlocked && hyperlocalOrderId != null && orderStatus != null) {
			if (dt.getPharmacyOrderId() != null) {
				orderStatusJdbc.updatePharmacyOrderStatus(hyperlocalOrderId, orderStatus);
			} else if (mealCancelResult != MealCancelProcessResult.APPLIED) {
				orderStatusJdbc.updateMealOrderStatus(hyperlocalOrderId, orderStatus);
				if ("delivered".equals(orderStatus)) {
					orderStatusJdbc.ensureMealOrderSettlementOnDelivered(hyperlocalOrderId);
				}
			}
		}
		log.info(
				"[PIDGE WEBHOOK] persisted_hyperlocal deliveryTrackingId={} finalDeliveryTrackingStatus={} normalizedInternal={} mealOrderOrPharmacyId={} orderRowStatusUpdate={}",
				dt.getId(),
				dt.getStatus(),
				normalized,
				hyperlocalOrderId,
				trackingDowngradeBlocked || orderStatus == null ? "skipped" : orderStatus);

		if (dt.getMealOrderId() != null || dt.getSubscriptionDeliveryId() != null) {
			try {
				mealDeliveryNotificationService.notifyMealRiderStageIfApplicable(
						dt, normalized, pidgeId, mealCancellationReason);
			} catch (Exception e) {
				log.warn("[PIDGE WEBHOOK] meal delivery notify failed: {}", e.getMessage());
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

	/**
	 * Resolves Pidge sandbox composites ({@code fulfilled|delivered}, etc.) and standard fulfillment enums.
	 * <p>Order: most specific composite first, then {@link #PIDGE_FULFILLMENT_STATUS_MAP}, then bare
	 * {@code fulfilled} → in_transit (never for {@code fulfilled|delivered}), then {@link #PIDGE_PARENT_STATUS_MAP}.
	 */
	public static PidgeStatusResolution resolvePidgeStatus(
			String rawFulfillmentStatus, String parentStatus, String dummyStatus) {
		String dummy = dummyStatus != null ? dummyStatus.trim().toLowerCase(Locale.ROOT) : "";
		String parent = parentStatus != null ? parentStatus.trim().toLowerCase(Locale.ROOT) : "";
		String rawFf = rawFulfillmentStatus != null ? rawFulfillmentStatus.trim().toLowerCase(Locale.ROOT) : "";

		String composite = !dummy.isEmpty() ? dummy : "";
		if (composite.isEmpty() && !rawFf.isEmpty() && rawFf.contains("|")) {
			composite = rawFf;
		}
		if (composite.isEmpty() && !parent.isEmpty() && parent.contains("|")) {
			composite = parent;
		}

		if ("fulfilled|delivered".equals(composite)) {
			return new PidgeStatusResolution("delivered", composite);
		}
		if ("fulfilled|picked_up".equals(composite)) {
			return new PidgeStatusResolution("picked_up", composite);
		}
		if ("fulfilled|on_the_way".equals(composite)) {
			return new PidgeStatusResolution("in_transit", composite);
		}
		if (!composite.isEmpty() && composite.contains("|")) {
			return new PidgeStatusResolution("unknown", composite);
		}

		String ffUpper = rawFf.isEmpty() ? "" : rawFulfillmentStatus.trim().toUpperCase(Locale.ROOT);
		if (!ffUpper.isEmpty() && !rawFf.contains("|")) {
			String m = PIDGE_FULFILLMENT_STATUS_MAP.get(ffUpper);
			if (m != null) {
				return new PidgeStatusResolution(m, "");
			}
		}

		if ("fulfilled".equals(parent) || "fulfilled".equals(rawFf)) {
			return new PidgeStatusResolution("in_transit", "fulfilled");
		}

		String p = PIDGE_PARENT_STATUS_MAP.get(parent);
		if (p != null) {
			return new PidgeStatusResolution(p, "");
		}

		String pRaw = PIDGE_PARENT_STATUS_MAP.get(rawFf);
		if (pRaw != null) {
			return new PidgeStatusResolution(pRaw, "");
		}

		return new PidgeStatusResolution("unknown", "");
	}

	/** Outcome of {@link #resolvePidgeStatus(String, String, String)} for logging and tests. */
	public record PidgeStatusResolution(String normalized, String compositeKey) {}

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
			case "nearby" -> "nearby";
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
			case "nearby", "in_transit", "out_for_delivery", "unknown" -> "on_the_way";
			case "awb_generated", "pickup_scheduled", "pending" -> "ready_for_pickup";
			default -> null;
		};
	}

	private static BigDecimal readRiderCoord(JsonNode rider, String... keys) {
		if (rider == null || rider.isNull()) {
			return null;
		}
		for (String key : keys) {
			if (!rider.has(key) || rider.get(key).isNull()) {
				continue;
			}
			JsonNode node = rider.get(key);
			if (node.isNumber() && Double.isFinite(node.asDouble())) {
				return BigDecimal.valueOf(node.asDouble());
			}
		}
		return null;
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

	private static String extractRiderPhoto(JsonNode rider) {
		if (rider == null || rider.isNull()) {
			return null;
		}
		for (String field : List.of("img", "image", "photo", "photo_url", "avatar", "profile_image")) {
			if (rider.hasNonNull(field)) {
				String v = rider.get(field).asText().trim();
				if (!v.isEmpty()) {
					return v;
				}
			}
		}
		return null;
	}

	private void persistHyperlocalGps(DeliveryTracking dt, BigDecimal lat, BigDecimal lng, Instant recordedAt) {
		if (!DeliveryLocationHistoryWriter.isValidCoord(lat, lng)) {
			return;
		}
		if (DeliveryLocationHistoryWriter.coordsEqual(dt.getCurrentLat(), dt.getCurrentLng(), lat, lng)) {
			deliveryLocationHistoryWriter.appendIfChanged(dt.getId(), lat, lng, "pidge", recordedAt);
			return;
		}
		dt.setCurrentLat(lat);
		dt.setCurrentLng(lng);
		dt.setLastLocationUpdate(recordedAt != null ? recordedAt : Instant.now());
		deliveryLocationHistoryWriter.appendIfChanged(dt.getId(), lat, lng, "pidge", recordedAt);
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
		try {
			log.info("[PIDGE RIDER TASK RAW] {}", objectMapper.writeValueAsString(payload));
		} catch (Exception e) {
			log.info("[PIDGE RIDER TASK RAW] <unserializable: {}>", e.getMessage());
		}

		JsonNode rider = payload.path("rider");
		String riderName = extractRiderName(rider);
		String riderPhone = extractRiderPhone(rider);
		String riderPhoto = extractRiderPhoto(rider);
		BigDecimal riderLat = readRiderCoord(rider, "current_latitude", "latitude", "lat");
		BigDecimal riderLng = readRiderCoord(rider, "current_longitude", "longitude", "lng", "lon");

		log.info(
				"[PIDGE RIDER TASK PARSED] riderName={}, phone={}, lat={}, lng={}, orderDetailCount={}",
				riderName,
				riderPhone,
				riderLat,
				riderLng,
				payload.has("order_details") && payload.get("order_details").isArray()
						? payload.get("order_details").size()
						: 0);
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
					riderPhoto,
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
			String riderPhoto,
			BigDecimal riderLat,
			BigDecimal riderLng,
			String updateSource,
			long eventTimestamp) {
		String rawDetailStatus = detail.hasNonNull("status") ? detail.get("status").asText() : "";
		String dummyDetail = detail.hasNonNull("dummy_status") ? detail.get("dummy_status").asText() : "";
		PidgeStatusResolution riderResolved = resolvePidgeStatus(rawDetailStatus, "", dummyDetail);
		String normalized = riderResolved.normalized();
		log.info(
				"[PIDGE RIDER TASK] status_resolve fulfillmentId={} incomingDummyStatus={} rawDetailStatus={} compositeKey={} normalizedInternal={}",
				textOrNull(detail, "id"),
				dummyDetail,
				rawDetailStatus,
				riderResolved.compositeKey(),
				normalized);

		if (riderName != null && !riderName.isBlank()) {
			dt.setDeliveryPersonName(riderName);
		}
		if (riderPhone != null && !riderPhone.isBlank()) {
			dt.setDeliveryPersonPhone(riderPhone);
		}
		if (riderPhoto != null && !riderPhoto.isBlank()) {
			dt.setDeliveryPersonPhoto(riderPhoto);
		}
		if (riderLat != null && riderLng != null) {
			Instant ts = eventTimestamp > 0 ? Instant.ofEpochMilli(eventTimestamp) : Instant.now();
			persistHyperlocalGps(dt, riderLat, riderLng, ts);
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
		boolean riderDowngradeBlocked =
				"delivered".equalsIgnoreCase(dt.getStatus()) && !"delivered".equalsIgnoreCase(dtStatus);
		if (riderDowngradeBlocked) {
			log.info(
					"[PIDGE RIDER TASK] skip_tracking_status_downgrade deliveryTrackingId={} keepingDbStatus=delivered attemptedNormalized={}",
					dt.getId(),
					normalized);
		} else {
			dt.setStatus(dtStatus);
			if ("picked_up".equals(normalized) && dt.getPickedUpAt() == null) {
				dt.setPickedUpAt(Instant.now());
			}
			if ("delivered".equals(normalized)) {
				dt.setDeliveredAt(Instant.now());
			}
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
		if (!riderDowngradeBlocked && hyperlocalOrderId != null && orderStatus != null) {
			if (dt.getPharmacyOrderId() != null) {
				orderStatusJdbc.updatePharmacyOrderStatus(hyperlocalOrderId, orderStatus);
			} else {
				orderStatusJdbc.updateMealOrderStatus(hyperlocalOrderId, orderStatus);
				if ("delivered".equals(orderStatus)) {
					orderStatusJdbc.ensureMealOrderSettlementOnDelivered(hyperlocalOrderId);
				}
			}
		}
		log.info(
				"[PIDGE RIDER TASK] persisted_order_detail deliveryTrackingId={} finalDeliveryTrackingStatus={} normalizedInternal={} mealOrderOrPharmacyId={} orderRowStatusUpdate={} deliveryPersonName={} deliveryPersonPhone={} currentLat={} currentLng={}",
				dt.getId(),
				dt.getStatus(),
				normalized,
				hyperlocalOrderId,
				riderDowngradeBlocked || orderStatus == null ? "skipped" : orderStatus,
				dt.getDeliveryPersonName(),
				dt.getDeliveryPersonPhone(),
				dt.getCurrentLat(),
				dt.getCurrentLng());
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
