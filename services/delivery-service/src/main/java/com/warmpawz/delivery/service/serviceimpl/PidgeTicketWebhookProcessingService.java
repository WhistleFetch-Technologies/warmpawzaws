package com.warmpawz.delivery.service.serviceimpl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.warmpawz.delivery.entity.DeliveryTracking;
import com.warmpawz.delivery.repository.DeliveryTrackingRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Pidge Ticket Management — Webhook Ticket Status Update (inbound to {@code update_info.callback_url}).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PidgeTicketWebhookProcessingService {

	private final JdbcTemplate jdbc;
	private final ObjectMapper objectMapper;
	private final DeliveryTrackingRepository deliveryTrackingRepository;

	static boolean isTicketStatusPayload(JsonNode payload) {
		if (payload == null || !payload.isObject()) {
			return false;
		}
		if (PidgeWebhookProcessingService.isRiderTaskPayload(payload)) {
			return false;
		}
		if (!payload.hasNonNull("ticket_id")) {
			return false;
		}
		// Order status webhooks use root "id" + "fulfillment", not ticket_id.
		if (payload.has("fulfillment") && payload.get("fulfillment").isObject()) {
			return false;
		}
		return payload.hasNonNull("pidge_id")
				|| payload.hasNonNull("issue_category")
				|| payload.hasNonNull("issue_subcategory");
	}

	@Transactional
	public Map<String, Object> handleTicketStatusPayload(JsonNode payload) {
		String ticketId = textOrNull(payload, "ticket_id");
		if (ticketId == null || ticketId.isBlank()) {
			return Map.of("error", "Missing ticket_id");
		}
		ticketId = ticketId.trim();

		String pidgeOrderId = textOrNull(payload, "pidge_id");
		String issueCategory = textOrNull(payload, "issue_category");
		String issueSubcategory = textOrNull(payload, "issue_subcategory");
		String description = textOrNull(payload, "description");
		String status = textOrNull(payload, "status");
		if (status == null || status.isBlank()) {
			status = "UNKNOWN";
		}
		String orderStatus = textOrNull(payload, "order_status");

		JsonNode updateInfo = payload.path("update_info");
		String callbackUrl = null;
		String pocNumber = null;
		String pocEmail = null;
		if (updateInfo.isObject()) {
			callbackUrl = textOrNull(updateInfo, "callback_url");
			pocNumber = textOrNull(updateInfo, "poc_number");
			pocEmail = textOrNull(updateInfo, "poc_email");
		}

		Instant pidgeCreatedAt = parseInstant(textOrNull(payload, "created_at"));
		Instant pidgeUpdatedAt = parseInstant(textOrNull(payload, "updated_at"));

		UUID mealOrderId = null;
		UUID pharmacyOrderId = null;
		UUID deliveryTrackingId = null;
		if (pidgeOrderId != null && !pidgeOrderId.isBlank()) {
			OrderLink link = resolveOrderLink(pidgeOrderId.trim());
			mealOrderId = link.mealOrderId();
			pharmacyOrderId = link.pharmacyOrderId();
			deliveryTrackingId = link.deliveryTrackingId();
		}

		String payloadJson;
		try {
			payloadJson = objectMapper.writeValueAsString(payload);
		} catch (Exception e) {
			payloadJson = payload.toString();
		}

		jdbc.update(
				"""
						INSERT INTO pidge_support_tickets (
						  ticket_id, pidge_order_id, issue_category, issue_subcategory, description,
						  status, order_status, callback_url, poc_number, poc_email,
						  meal_order_id, pharmacy_order_id, delivery_tracking_id,
						  payload, pidge_created_at, pidge_updated_at, updated_at
						) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?, NOW())
						ON CONFLICT (ticket_id) DO UPDATE SET
						  pidge_order_id = EXCLUDED.pidge_order_id,
						  issue_category = EXCLUDED.issue_category,
						  issue_subcategory = EXCLUDED.issue_subcategory,
						  description = EXCLUDED.description,
						  status = EXCLUDED.status,
						  order_status = EXCLUDED.order_status,
						  callback_url = EXCLUDED.callback_url,
						  poc_number = EXCLUDED.poc_number,
						  poc_email = EXCLUDED.poc_email,
						  meal_order_id = COALESCE(EXCLUDED.meal_order_id, pidge_support_tickets.meal_order_id),
						  pharmacy_order_id = COALESCE(EXCLUDED.pharmacy_order_id, pidge_support_tickets.pharmacy_order_id),
						  delivery_tracking_id = COALESCE(EXCLUDED.delivery_tracking_id, pidge_support_tickets.delivery_tracking_id),
						  payload = EXCLUDED.payload,
						  pidge_created_at = COALESCE(EXCLUDED.pidge_created_at, pidge_support_tickets.pidge_created_at),
						  pidge_updated_at = EXCLUDED.pidge_updated_at,
						  updated_at = NOW()
						""",
				ticketId,
				pidgeOrderId,
				issueCategory,
				issueSubcategory,
				description,
				status,
				orderStatus,
				callbackUrl,
				pocNumber,
				pocEmail,
				mealOrderId,
				pharmacyOrderId,
				deliveryTrackingId,
				payloadJson,
				toTimestamp(pidgeCreatedAt),
				toTimestamp(pidgeUpdatedAt));

		Map<String, Object> out = new HashMap<>();
		out.put("success", true);
		out.put("message", "Pidge ticket status webhook processed");
		out.put("type", "ticket_status");
		out.put("ticketId", ticketId);
		if (pidgeOrderId != null) {
			out.put("pidgeOrderId", pidgeOrderId);
		}
		if (mealOrderId != null) {
			out.put("mealOrderId", mealOrderId.toString());
		}
		if (pharmacyOrderId != null) {
			out.put("pharmacyOrderId", pharmacyOrderId.toString());
		}
		return out;
	}

	private OrderLink resolveOrderLink(String pidgeOrderId) {
		Optional<DeliveryTracking> trackingOpt = deliveryTrackingRepository
				.findFirstByLogisticsPartnerAndExternalTaskIdOrderByCreatedAtDesc("pidge", pidgeOrderId);
		if (trackingOpt.isPresent()) {
			DeliveryTracking dt = trackingOpt.get();
			return new OrderLink(dt.getMealOrderId(), dt.getPharmacyOrderId(), dt.getId());
		}

		List<UUID> mealIds = jdbc.query(
				"SELECT id FROM meal_orders WHERE pidge_order_id = ? LIMIT 1",
				(rs, i) -> rs.getObject(1, UUID.class),
				pidgeOrderId);
		if (!mealIds.isEmpty()) {
			UUID mealOrderId = mealIds.get(0);
			List<UUID> dtIds = jdbc.query(
					"""
							SELECT id FROM delivery_tracking
							WHERE meal_order_id = ? AND logistics_partner = 'pidge'
							ORDER BY created_at DESC LIMIT 1
							""",
					(rs, i) -> rs.getObject(1, UUID.class),
					mealOrderId);
			return new OrderLink(mealOrderId, null, dtIds.isEmpty() ? null : dtIds.get(0));
		}

		List<OrderLink> pharmacyLinks = jdbc.query(
				"""
						SELECT pharmacy_order_id, id FROM delivery_tracking
						WHERE logistics_partner = 'pidge' AND external_task_id = ?
						ORDER BY created_at DESC LIMIT 1
						""",
				(rs, i) -> new OrderLink(
						null,
						rs.getObject("pharmacy_order_id", UUID.class),
						rs.getObject("id", UUID.class)),
				pidgeOrderId);
		if (!pharmacyLinks.isEmpty()) {
			return pharmacyLinks.get(0);
		}

		return new OrderLink(null, null, null);
	}

	private record OrderLink(UUID mealOrderId, UUID pharmacyOrderId, UUID deliveryTrackingId) {}

	private static String textOrNull(JsonNode node, String field) {
		return node != null && node.hasNonNull(field) ? node.get(field).asText() : null;
	}

	private static Instant parseInstant(String iso) {
		if (iso == null || iso.isBlank()) {
			return null;
		}
		try {
			return Instant.parse(iso);
		} catch (Exception e) {
			return null;
		}
	}

	private static Timestamp toTimestamp(Instant instant) {
		return instant == null ? null : Timestamp.from(instant);
	}
}
