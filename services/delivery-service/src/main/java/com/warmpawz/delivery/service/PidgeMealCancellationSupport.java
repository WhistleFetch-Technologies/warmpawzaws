package com.warmpawz.delivery.service;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.Locale;

/**
 * Extracts cancellation metadata from Pidge order status webhooks (hyperlocal meals).
 */
public final class PidgeMealCancellationSupport {

	public static final String CANCELLED_BY_SYSTEM_PIDGE = "system_pidge";
	public static final String EVENT_KIND_MEAL_CANCELLED = "meal_cancelled";
	public static final String IDEMPOTENCY_PREFIX = "pidge:hyperlocal:meal_cancel:";

	private PidgeMealCancellationSupport() {}

	public static String cancelIdempotencyKey(String pidgeOrderId) {
		return IDEMPOTENCY_PREFIX + (pidgeOrderId != null ? pidgeOrderId.trim() : "");
	}

	/**
	 * Human-readable reason for {@code meal_orders.cancellation_reason} (not a refund decision).
	 */
	public static String extractCancellationReason(
			String parentStatus,
			String fulfillmentStatus,
			String dummyStatus,
			JsonNode lastLog) {
		StringBuilder sb = new StringBuilder("pidge_logistics_cancelled");
		if (parentStatus != null && !parentStatus.isBlank()) {
			sb.append(";parent=").append(parentStatus.trim().toLowerCase(Locale.ROOT));
		}
		if (fulfillmentStatus != null && !fulfillmentStatus.isBlank()) {
			sb.append(";fulfillment=").append(fulfillmentStatus.trim().toUpperCase(Locale.ROOT));
		}
		if (dummyStatus != null && !dummyStatus.isBlank()) {
			sb.append(";dummy=").append(dummyStatus.trim());
		}
		if (lastLog != null) {
			if (lastLog.hasNonNull("remark")) {
				String remark = lastLog.get("remark").asText().trim();
				if (!remark.isEmpty()) {
					sb.append(";remark=").append(truncate(remark, 400));
				}
			}
			if (lastLog.hasNonNull("status")) {
				sb.append(";log_status=").append(lastLog.get("status").asText().trim());
			}
		}
		return sb.toString();
	}

	/** Customer-facing copy for push/in-app — never expose internal audit tokens. */
	public static String toCustomerCancellationMessage(String auditReason) {
		if (auditReason != null && auditReason.toLowerCase(Locale.ROOT).contains("remark=")) {
			int idx = auditReason.indexOf(";remark=");
			if (idx >= 0) {
				String remark = auditReason.substring(idx + 8).trim();
				if (!remark.isEmpty() && !remark.startsWith("pidge_")) {
					return truncate(remark, 200);
				}
			}
		}
		return "Your refund is being processed.";
	}

	private static String truncate(String value, int maxLen) {
		if (value.length() <= maxLen) {
			return value;
		}
		return value.substring(0, maxLen) + "…";
	}
}
