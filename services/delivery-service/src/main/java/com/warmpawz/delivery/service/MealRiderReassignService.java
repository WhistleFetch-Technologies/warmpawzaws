package com.warmpawz.delivery.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.warmpawz.delivery.entity.DeliveryTracking;
import com.warmpawz.delivery.repository.DeliveryTrackingRepository;
import com.warmpawz.delivery.service.PidgeIntegrationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Admin-triggered Pidge rider reassign: unallocate fulfillment only; rider updates come from webhooks.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MealRiderReassignService {

	private static final Duration REASSIGN_DEBOUNCE = Duration.ofMinutes(2);

	private final JdbcTemplate jdbc;
	private final ObjectMapper objectMapper;
	private final DeliveryTrackingRepository deliveryTrackingRepository;
	private final PidgeIntegrationService pidgeIntegrationService;
	private final MealDeliveryNotificationService mealDeliveryNotificationService;

	@Transactional
	public Map<String, Object> reassignRider(JsonNode body) {
		String mealOrderIdRaw = body != null && body.hasNonNull("mealOrderId") ? body.get("mealOrderId").asText() : null;
		if (mealOrderIdRaw == null || mealOrderIdRaw.isBlank()) {
			return error("mealOrderId is required");
		}
		final UUID mealOrderId;
		try {
			mealOrderId = UUID.fromString(mealOrderIdRaw.trim());
		} catch (IllegalArgumentException e) {
			return error("mealOrderId must be a UUID");
		}

		String adminId = body.hasNonNull("adminId") ? body.get("adminId").asText() : null;
		String supportTicketIdRaw =
				body.hasNonNull("supportTicketId") ? body.get("supportTicketId").asText() : null;
		UUID supportTicketId = null;
		if (supportTicketIdRaw != null && !supportTicketIdRaw.isBlank()) {
			try {
				supportTicketId = UUID.fromString(supportTicketIdRaw.trim());
			} catch (IllegalArgumentException ignored) {
				// optional — store null
			}
		}
		String reason = body.hasNonNull("reason") ? body.get("reason").asText() : null;

		List<Map<String, Object>> moRows = jdbc.queryForList(
				"""
						SELECT id, status, payment_status, logistics_type, pidge_order_id, cancelled_by
						FROM meal_orders WHERE id = ?
						""",
				mealOrderId);
		if (moRows.isEmpty()) {
			return error("meal order not found");
		}
		Map<String, Object> mo = moRows.get(0);
		String eligibilityError = validateEligibility(mo, mealOrderId);
		if (eligibilityError != null) {
			return Map.of("success", false, "error", eligibilityError, "code", "not_eligible");
		}

		List<Map<String, Object>> dtRows = jdbc.queryForList(
				"""
						SELECT id, status, external_task_id, delivery_person_name, delivery_person_phone,
						       picked_up_at, metadata, logistics_partner
						FROM delivery_tracking
						WHERE meal_order_id = ? AND logistics_partner = 'pidge'
						ORDER BY created_at DESC LIMIT 1
						""",
				mealOrderId);
		if (dtRows.isEmpty()) {
			return Map.of("success", false, "error", "No Pidge delivery tracking for this order", "code", "not_eligible");
		}
		Map<String, Object> dtRow = dtRows.get(0);
		UUID trackingId = (UUID) dtRow.get("id");
		String pidgeOrderId = dtRow.get("external_task_id") != null
				? String.valueOf(dtRow.get("external_task_id"))
				: String.valueOf(mo.get("pidge_order_id"));
		if (pidgeOrderId == null || pidgeOrderId.isBlank() || "null".equals(pidgeOrderId)) {
			return Map.of("success", false, "error", "Pidge order id missing", "code", "not_eligible");
		}

		String prevName = dtRow.get("delivery_person_name") != null
				? String.valueOf(dtRow.get("delivery_person_name"))
				: null;
		String prevPhone = dtRow.get("delivery_person_phone") != null
				? String.valueOf(dtRow.get("delivery_person_phone"))
				: null;

		UUID reassignId = jdbc.queryForObject(
				"""
						INSERT INTO meal_rider_reassign_requests (
						  meal_order_id, delivery_tracking_id, pidge_order_id,
						  requested_by_admin_id, support_ticket_id, status,
						  previous_rider_name, previous_rider_phone
						) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
						RETURNING id
						""",
				UUID.class,
				mealOrderId,
				trackingId,
				pidgeOrderId,
				adminId,
				supportTicketId,
				prevName,
				prevPhone);

		Optional<DeliveryTracking> dtOpt = deliveryTrackingRepository.findById(trackingId);
		if (dtOpt.isPresent()) {
			DeliveryTracking dt = dtOpt.get();
			dt.setMetadataJson(
					DeliveryTrackingMetadataHelper.setReassignPending(
							dt.getMetadataJson(), objectMapper, reassignId, Instant.now()));
			dt.setUpdatedAt(Instant.now());
			deliveryTrackingRepository.save(dt);
		}

		try {
			pidgeIntegrationService.unallocateFulfillment(pidgeOrderId);
		} catch (Exception e) {
			log.error("[meal-reassign] Pidge unallocate failed mealOrderId={} pidgeOrderId={}: {}", mealOrderId, pidgeOrderId, e.getMessage());
			jdbc.update(
					"UPDATE meal_rider_reassign_requests SET status = 'failed', failure_reason = ?, completed_at = NOW() WHERE id = ?",
					truncate(e.getMessage(), 500),
					reassignId);
			if (dtOpt.isPresent()) {
				DeliveryTracking dt = dtOpt.get();
				dt.setMetadataJson(
						DeliveryTrackingMetadataHelper.clearReassignPending(dt.getMetadataJson(), objectMapper));
				deliveryTrackingRepository.save(dt);
			}
			return Map.of(
					"success", false,
					"error", "Pidge unallocate failed: " + truncate(e.getMessage(), 200),
					"code", "pidge_error",
					"reassignRequestId", reassignId.toString());
		}

		if (dtOpt.isPresent()) {
			try {
				mealDeliveryNotificationService.notifyMealRiderReassignPending(dtOpt.get(), pidgeOrderId);
			} catch (Exception e) {
				log.warn("[meal-reassign] notify pending failed: {}", e.getMessage());
			}
		}

		log.info(
				"[meal-reassign] initiated mealOrderId={} pidgeOrderId={} reassignRequestId={} adminId={}",
				mealOrderId,
				pidgeOrderId,
				reassignId,
				adminId);

		Map<String, Object> out = new LinkedHashMap<>();
		out.put("success", true);
		out.put("status", "reassign_pending");
		out.put("reassignRequestId", reassignId.toString());
		out.put("mealOrderId", mealOrderId.toString());
		out.put("pidgeOrderId", pidgeOrderId);
		out.put("message", "Rider unallocate requested; updates will sync via Pidge webhooks");
		return out;
	}

	public Map<String, Object> logisticsSummary(UUID mealOrderId) {
		List<Map<String, Object>> moRows = jdbc.queryForList(
				"""
						SELECT mo.id, mo.order_number, mo.status, mo.payment_status, mo.logistics_type,
						       mo.pidge_order_id, mo.cancelled_by, mo.cancelled_at
						FROM meal_orders mo WHERE mo.id = ?
						""",
				mealOrderId);
		if (moRows.isEmpty()) {
			return Map.of("success", false, "error", "meal order not found");
		}
		Map<String, Object> mo = moRows.get(0);
		List<Map<String, Object>> dtRows = jdbc.queryForList(
				"""
						SELECT id, status, external_task_id, delivery_person_name, delivery_person_phone,
						       picked_up_at, metadata, assigned_at, updated_at
						FROM delivery_tracking
						WHERE meal_order_id = ? AND logistics_partner = 'pidge'
						ORDER BY created_at DESC LIMIT 1
						""",
				mealOrderId);
		List<Map<String, Object>> reassignHistory = jdbc.queryForList(
				"""
						SELECT id, status, requested_by_admin_id, previous_rider_name, previous_rider_phone,
						       created_at, completed_at, failure_reason
						FROM meal_rider_reassign_requests
						WHERE meal_order_id = ?
						ORDER BY created_at DESC LIMIT 5
						""",
				mealOrderId);

		boolean reassignPending = false;
		Map<String, Object> tracking = dtRows.isEmpty() ? null : dtRows.get(0);
		if (tracking != null && tracking.get("metadata") != null) {
			reassignPending = DeliveryTrackingMetadataHelper.isReassignPending(
					String.valueOf(tracking.get("metadata")), objectMapper);
		}

		String eligibilityError = validateEligibility(mo, mealOrderId);
		boolean canReassign = eligibilityError == null && !reassignPending;

		Map<String, Object> out = new LinkedHashMap<>();
		out.put("success", true);
		out.put("order", mo);
		out.put("tracking", tracking);
		out.put("reassignHistory", reassignHistory);
		out.put("reassignPending", reassignPending);
		out.put("canReassign", canReassign);
		out.put("reassignBlockedReason", reassignPending ? "Reassign already in progress" : eligibilityError);
		return out;
	}

	public boolean hasOpenReassignRequest(UUID mealOrderId) {
		Integer count = jdbc.queryForObject(
				"SELECT COUNT(*)::int FROM meal_rider_reassign_requests WHERE meal_order_id = ? AND status = 'pending'",
				Integer.class,
				mealOrderId);
		return count != null && count > 0;
	}

	@Transactional
	public void completeReassignIfPending(DeliveryTracking dt, String pidgeOrderId, String newRiderName) {
		if (dt == null || dt.getMealOrderId() == null) {
			return;
		}
		if (!DeliveryTrackingMetadataHelper.isReassignPending(dt.getMetadataJson(), objectMapper)
				&& !hasOpenReassignRequest(dt.getMealOrderId())) {
			return;
		}
		if (newRiderName == null || newRiderName.isBlank()) {
			return;
		}
		List<UUID> pendingIds = jdbc.query(
				"""
						SELECT id FROM meal_rider_reassign_requests
						WHERE meal_order_id = ? AND status = 'pending'
						ORDER BY created_at DESC
						""",
				(rs, i) -> rs.getObject("id", UUID.class),
				dt.getMealOrderId());
		if (pendingIds.isEmpty()) {
			dt.setMetadataJson(
					DeliveryTrackingMetadataHelper.clearReassignPending(dt.getMetadataJson(), objectMapper));
			return;
		}
		UUID reassignId = pendingIds.get(0);
		jdbc.update(
				"UPDATE meal_rider_reassign_requests SET status = 'completed', completed_at = NOW() WHERE id = ?",
				reassignId);
		if (pendingIds.size() > 1) {
			jdbc.update(
					"UPDATE meal_rider_reassign_requests SET status = 'superseded', completed_at = NOW() WHERE meal_order_id = ? AND status = 'pending'",
					dt.getMealOrderId());
		}
		dt.setMetadataJson(DeliveryTrackingMetadataHelper.clearReassignPending(dt.getMetadataJson(), objectMapper));
		try {
			mealDeliveryNotificationService.notifyMealRiderReassigned(dt, pidgeOrderId, newRiderName);
		} catch (Exception e) {
			log.warn("[meal-reassign] notify reassigned failed: {}", e.getMessage());
		}
		log.info(
				"[meal-reassign] completed mealOrderId={} reassignRequestId={} newRider={}",
				dt.getMealOrderId(),
				reassignId,
				newRiderName);
	}

	@Transactional
	public void handleReassignPhaseWebhook(DeliveryTracking dt, String normalized) {
		if (dt == null || dt.getMealOrderId() == null) {
			return;
		}
		boolean pending = DeliveryTrackingMetadataHelper.isReassignPending(dt.getMetadataJson(), objectMapper)
				|| hasOpenReassignRequest(dt.getMealOrderId());
		if (!pending) {
			return;
		}
		// Clear stale rider on unallocate / pending assignment webhooks
		if ("cancelled".equalsIgnoreCase(normalized) || "pending".equalsIgnoreCase(normalized)
				|| "awb_generated".equalsIgnoreCase(normalized) || "pickup_scheduled".equalsIgnoreCase(normalized)) {
			dt.setDeliveryPersonName(null);
			dt.setDeliveryPersonPhone(null);
			dt.setDeliveryPersonPhoto(null);
			dt.setCurrentLat(null);
			dt.setCurrentLng(null);
			dt.setStatus("pending_assignment");
			dt.setUpdatedAt(Instant.now());
			deliveryTrackingRepository.save(dt);
			log.info(
					"[meal-reassign] cleared rider on webhook normalized={} deliveryTrackingId={}",
					normalized,
					dt.getId());
		}
	}

	private String validateEligibility(Map<String, Object> mo, UUID mealOrderId) {
		String logisticsType = mo.get("logistics_type") != null ? String.valueOf(mo.get("logistics_type")) : "";
		if (!"pidge".equalsIgnoreCase(logisticsType.trim())) {
			return "Order does not use Pidge logistics";
		}
		String paymentStatus = mo.get("payment_status") != null ? String.valueOf(mo.get("payment_status")) : "";
		if (!"paid".equalsIgnoreCase(paymentStatus.trim())) {
			return "Order is not paid";
		}
		String status = mo.get("status") != null ? String.valueOf(mo.get("status")) : "";
		if (!"ready_for_pickup".equalsIgnoreCase(status.trim())) {
			return "Reassign is only allowed when order is ready for pickup (pre-pickup)";
		}
		String cancelledBy = mo.get("cancelled_by") != null ? String.valueOf(mo.get("cancelled_by")) : "";
		if (cancelledBy != null && !cancelledBy.isBlank() && !"null".equals(cancelledBy)) {
			return "Order is cancelled";
		}

		List<Map<String, Object>> dtRows = jdbc.queryForList(
				"""
						SELECT status, picked_up_at, external_task_id
						FROM delivery_tracking
						WHERE meal_order_id = ? AND logistics_partner = 'pidge'
						ORDER BY created_at DESC LIMIT 1
						""",
				mealOrderId);
		if (dtRows.isEmpty()) {
			return "No Pidge delivery tracking row";
		}
		Map<String, Object> dt = dtRows.get(0);
		if (dt.get("picked_up_at") != null) {
			return "Order already picked up";
		}
		String dtStatus = dt.get("status") != null ? String.valueOf(dt.get("status")).toLowerCase() : "";
		if ("delivered".equals(dtStatus) || "cancelled".equals(dtStatus) || "failed".equals(dtStatus)) {
			return "Delivery is in terminal state: " + dtStatus;
		}
		String extId = dt.get("external_task_id") != null ? String.valueOf(dt.get("external_task_id")) : "";
		if (extId.isBlank() || "null".equals(extId)) {
			return "Pidge order id missing on tracking row";
		}

		List<Map<String, Object>> recent = jdbc.queryForList(
				"""
						SELECT created_at FROM meal_rider_reassign_requests
						WHERE meal_order_id = ? AND status IN ('pending', 'completed')
						ORDER BY created_at DESC LIMIT 1
						""",
				mealOrderId);
		if (!recent.isEmpty() && recent.get(0).get("created_at") != null) {
			Instant last = ((java.sql.Timestamp) recent.get(0).get("created_at")).toInstant();
			if (Duration.between(last, Instant.now()).compareTo(REASSIGN_DEBOUNCE) < 0) {
				return "Please wait before requesting another reassign";
			}
		}
		return null;
	}

	private static Map<String, Object> error(String message) {
		return Map.of("success", false, "error", message);
	}

	private static String truncate(String s, int max) {
		if (s == null) {
			return "";
		}
		return s.length() <= max ? s : s.substring(0, max);
	}
}
