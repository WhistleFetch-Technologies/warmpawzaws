package com.warmpawz.delivery.service.serviceimpl;

import com.fasterxml.jackson.databind.JsonNode;
import com.warmpawz.delivery.entity.DeliveryTracking;
import com.warmpawz.delivery.repository.DeliveryTrackingRepository;
import com.warmpawz.delivery.service.PidgeIntegrationService;
import com.warmpawz.delivery.util.PidgeOrderIdMap;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * POST /logistics/meal/dispatch — schedule a Pidge rider for a meal order while the vendor is still preparing.
 * <p>
 * Idempotent: if a {@code delivery_tracking} row already exists for the meal order with
 * {@code logistics_partner='pidge'} and {@code external_task_id}, the existing record is returned without a new
 * Pidge create call. Lambda calls this on {@code ready_for_pickup} by default (or {@code preparing} when
 * {@code MEAL_PIDGE_DISPATCH_ON=preparing}).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MealLogisticsDispatchService {

	private final DeliveryTrackingRepository deliveryTrackingRepository;
	private final PidgeIntegrationService pidgeIntegrationService;
	private final JdbcTemplate jdbc;

	@Transactional
	public Map<String, Object> dispatch(JsonNode body) {
		String mealOrderIdRaw = body == null ? null : (body.hasNonNull("mealOrderId") ? body.get("mealOrderId").asText() : null);
		if (mealOrderIdRaw == null || mealOrderIdRaw.isBlank()) {
			return Map.of("error", "mealOrderId is required");
		}
		final UUID mealOrderId;
		try {
			mealOrderId = UUID.fromString(mealOrderIdRaw.trim());
		} catch (IllegalArgumentException e) {
			return Map.of("error", "mealOrderId must be a UUID");
		}

		List<Map<String, Object>> moRows = jdbc.queryForList(
				"SELECT id, status FROM meal_orders WHERE id = ?", mealOrderId);
		if (moRows.isEmpty()) {
			return Map.of("error", "meal order not found");
		}

		List<Map<String, Object>> existing = jdbc.queryForList(
				"SELECT id, external_task_id, status FROM delivery_tracking "
						+ "WHERE meal_order_id = ? AND logistics_partner = 'pidge' "
						+ "ORDER BY created_at DESC LIMIT 1",
				mealOrderId);
		if (!existing.isEmpty() && existing.get(0).get("external_task_id") != null) {
			Object existingPidgeId = existing.get(0).get("external_task_id");
			Object existingTrackingId = existing.get(0).get("id");
			Map<String, Object> out = new LinkedHashMap<>();
			out.put("success", true);
			out.put("idempotent", true);
			out.put("pidgeOrderId", existingPidgeId);
			out.put("deliveryTrackingId", existingTrackingId);
			out.put("status", existing.get(0).get("status"));
			return out;
		}

		JsonNode pidgePayload = body.path("pidgePayload");
		if (pidgePayload == null || !pidgePayload.isObject() || pidgePayload.isEmpty()) {
			return Map.of("error", "pidgePayload (compact) is required");
		}

		JsonNode pidgeResp;
		try {
			pidgeResp = pidgeIntegrationService.createOrder(pidgePayload);
		} catch (Exception e) {
			log.error("[meal-dispatch] Pidge createOrder failed for {}: {}", mealOrderId, e.getMessage());
			return Map.of("error", "Pidge create failed: " + e.getMessage());
		}

		Map<String, String> idMap = PidgeOrderIdMap.extract(pidgeResp);
		String pidgeOrderId = idMap.values().stream().findFirst().orElse(null);
		if (pidgeOrderId == null || pidgeOrderId.isBlank()) {
			log.error("[meal-dispatch] Pidge response missing order id for {}: {}", mealOrderId, pidgeResp);
			return Map.of("error", "Pidge response had no order id");
		}

		DeliveryTracking dt = new DeliveryTracking();
		dt.setMealOrderId(mealOrderId);
		dt.setLogisticsPartner("pidge");
		dt.setExternalTaskId(pidgeOrderId);
		dt.setStatus("heading_to_pickup");
		dt.setAssignedAt(Instant.now());
		String dispatchTrigger = body.hasNonNull("dispatchTrigger")
				? body.get("dispatchTrigger").asText().trim()
				: "vendor_preparing";
		if (dispatchTrigger.isEmpty()) {
			dispatchTrigger = "vendor_preparing";
		}
		String triggerMeta = dispatchTrigger.startsWith("vendor_")
				? dispatchTrigger
				: "vendor_" + dispatchTrigger;
		dt.setMetadataJson("{\"pidge_order_id\":\"" + pidgeOrderId.replace("\"", "")
				+ "\",\"trigger\":\"" + triggerMeta.replace("\"", "") + "\"}");
		dt = deliveryTrackingRepository.save(dt);

		try {
			jdbc.update(
					"UPDATE meal_orders SET pidge_order_id = ?, logistics_type = 'pidge', updated_at = NOW() WHERE id = ?",
					pidgeOrderId, mealOrderId);
		} catch (Exception e) {
			log.warn("[meal-dispatch] failed to update meal_orders.pidge_order_id for {}: {}",
					mealOrderId, e.getMessage());
		}

		Map<String, Object> out = new LinkedHashMap<>();
		out.put("success", true);
		out.put("pidgeOrderId", pidgeOrderId);
		out.put("deliveryTrackingId", dt.getId());
		out.put("status", dt.getStatus());
		return out;
	}
}
