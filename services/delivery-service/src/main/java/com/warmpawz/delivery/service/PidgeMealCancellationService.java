package com.warmpawz.delivery.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

/**
 * Phase 1 — Pidge meal logistics cancel: persist attribution, archive webhook, idempotency (no refunds).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PidgeMealCancellationService {

	public enum MealCancelProcessResult {
		/** First cancel webhook: archived + meal row updated. */
		APPLIED,
		/** Duplicate cancel webhook for same Pidge order — no side effects. */
		DUPLICATE,
		/** Not a meal hyperlocal cancel (caller should use default flow). */
		NOT_APPLICABLE
	}

	public record MealCancelOutcome(MealCancelProcessResult result, UUID webhookEventId) {
		public static MealCancelOutcome notApplicable() {
			return new MealCancelOutcome(MealCancelProcessResult.NOT_APPLICABLE, null);
		}
	}

	private final JdbcTemplate jdbc;
	private final ObjectMapper objectMapper;
	private final OrderStatusJdbcService orderStatusJdbc;

	public MealCancelOutcome tryProcessMealCancellation(
			UUID mealOrderId,
			UUID deliveryTrackingId,
			String pidgeOrderId,
			String normalizedStatus,
			String parentStatus,
			String fulfillmentStatus,
			String dummyStatus,
			JsonNode lastLog,
			JsonNode fullPayload) {
		if (mealOrderId == null || pidgeOrderId == null || pidgeOrderId.isBlank()) {
			return MealCancelOutcome.notApplicable();
		}
		if (!"cancelled".equalsIgnoreCase(normalizedStatus)) {
			return MealCancelOutcome.notApplicable();
		}

		String idempotencyKey = PidgeMealCancellationSupport.cancelIdempotencyKey(pidgeOrderId);
		String cancellationReason = PidgeMealCancellationSupport.extractCancellationReason(
				parentStatus, fulfillmentStatus, dummyStatus, lastLog);

		List<UUID> insertedIds;
		try {
			String payloadJson = objectMapper.writeValueAsString(fullPayload);
			insertedIds = jdbc.query(
					"""
							INSERT INTO pidge_hyperlocal_webhook_events (
							    pidge_order_id, event_kind, idempotency_key,
							    meal_order_id, delivery_tracking_id,
							    normalized_status, parent_status, fulfillment_status,
							    cancellation_reason, payload
							) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb)
							ON CONFLICT (idempotency_key) DO NOTHING
							RETURNING id
							""",
					(rs, rowNum) -> (UUID) rs.getObject("id"),
					pidgeOrderId,
					PidgeMealCancellationSupport.EVENT_KIND_MEAL_CANCELLED,
					idempotencyKey,
					mealOrderId,
					deliveryTrackingId,
					normalizedStatus,
					parentStatus,
					fulfillmentStatus,
					cancellationReason,
					payloadJson);
			if (insertedIds.isEmpty()) {
				log.info(
						"[PIDGE MEAL CANCEL] duplicate idempotency pidgeOrderId={} mealOrderId={}",
						pidgeOrderId,
						mealOrderId);
				return new MealCancelOutcome(MealCancelProcessResult.DUPLICATE, null);
			}
		} catch (Exception e) {
			log.warn("[PIDGE MEAL CANCEL] archive insert failed pidgeOrderId={}: {}", pidgeOrderId, e.getMessage());
			throw new IllegalStateException("Failed to archive Pidge cancel webhook", e);
		}

		int mealRows = orderStatusJdbc.updateMealOrderCancelledByLogistics(
				mealOrderId,
				PidgeMealCancellationSupport.CANCELLED_BY_SYSTEM_PIDGE,
				cancellationReason);
		UUID webhookEventId = insertedIds.get(0);
		log.info(
				"[PIDGE MEAL CANCEL] applied pidgeOrderId={} mealOrderId={} mealRowsUpdated={} webhookEventId={} reason={}",
				pidgeOrderId,
				mealOrderId,
				mealRows,
				webhookEventId,
				cancellationReason);

		return new MealCancelOutcome(MealCancelProcessResult.APPLIED, webhookEventId);
	}
}
