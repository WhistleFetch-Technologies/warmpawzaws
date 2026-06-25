package com.warmpawz.delivery.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.warmpawz.delivery.config.MealDeliveryNotifyProperties;
import com.warmpawz.delivery.entity.DeliveryTracking;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * Notifies customer + vendor via Lambda (in-app + FCM) when Pidge webhook advances meal hyperlocal delivery.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MealDeliveryNotificationService {

	private final MealDeliveryNotifyProperties properties;
	private final JdbcTemplate jdbc;
	private final ObjectMapper objectMapper;
	private final RestTemplate restTemplate = new RestTemplate();

	public void notifyMealRiderStageIfApplicable(
			DeliveryTracking dt,
			String normalizedInternal,
			String pidgeOrderId) {
		notifyMealRiderStageIfApplicable(dt, normalizedInternal, pidgeOrderId, null);
	}

	/** Separate transaction so notify/SQL failures never roll back Pidge webhook status persistence. */
	@Transactional(propagation = Propagation.REQUIRES_NEW)
	public void notifyMealRiderStageIfApplicable(
			DeliveryTracking dt,
			String normalizedInternal,
			String pidgeOrderId,
			String cancellationReason) {
		if (dt == null) {
			return;
		}
		UUID mealOrderId = dt.getMealOrderId();
		if (mealOrderId == null && dt.getSubscriptionDeliveryId() != null) {
			mealOrderId = resolveMealOrderIdForSubscription(dt.getSubscriptionDeliveryId());
		}
		if (mealOrderId == null) {
			return;
		}

		MealOrderContext ctx = loadMealOrderContext(mealOrderId);
		if (ctx == null) {
			log.warn("[meal-delivery-notify] skip — no context for meal order {}", mealOrderId);
			return;
		}

		String customerEvent = mapCustomerRiderEventType(normalizedInternal, dt.getStatus());
		if (customerEvent != null && ctx.customerId() != null) {
			ObjectNode customerBody =
					buildBody(ctx, mealOrderId, dt, pidgeOrderId, customerEvent, "customer", ctx.customerId());
			if (cancellationReason != null && !cancellationReason.isBlank()) {
				customerBody.put(
						"customerMessage",
						PidgeMealCancellationSupport.toCustomerCancellationMessage(cancellationReason));
			}
			dispatchMealNotify(customerBody, mealOrderId, pidgeOrderId, ctx.customerId(), ctx.vendorId());
		} else if (isLogisticsTerminal(normalizedInternal, dt.getStatus())) {
			log.warn(
					"[PIDGE CANCEL NOTIFY] skip customer mealOrderId={} pidgeOrderId={} normalized={} trackingStatus={} — no customer event mapping",
					mealOrderId,
					pidgeOrderId,
					normalizedInternal,
					dt.getStatus());
		}

		String vendorEvent = mapVendorRiderEventType(normalizedInternal, dt.getStatus());
		if (vendorEvent != null && ctx.vendorId() != null) {
			dispatchMealNotify(
					buildBody(ctx, mealOrderId, dt, pidgeOrderId, vendorEvent, "vendor", ctx.vendorId()),
					mealOrderId,
					pidgeOrderId,
					ctx.customerId(),
					ctx.vendorId());
		} else if (isLogisticsTerminal(normalizedInternal, dt.getStatus())) {
			log.warn(
					"[PIDGE CANCEL NOTIFY] skip vendor mealOrderId={} pidgeOrderId={} normalized={} trackingStatus={} — no vendor event mapping",
					mealOrderId,
					pidgeOrderId,
					normalizedInternal,
					dt.getStatus());
		}
	}

	private static boolean isLogisticsTerminal(String normalized, String trackingStatus) {
		String n = normalized != null ? normalized.trim().toLowerCase(Locale.ROOT) : "";
		String dt = trackingStatus != null ? trackingStatus.trim().toLowerCase(Locale.ROOT) : "";
		return "cancelled".equals(n) || "failed".equals(n) || "lost".equals(n) || "damaged".equals(n) || "failed".equals(dt);
	}

	private void dispatchMealNotify(
			ObjectNode body,
			UUID mealOrderId,
			String pidgeOrderId,
			UUID customerId,
			UUID vendorId) {
		String eventType = body.path("eventType").asText("");
		String recipientType = body.path("recipientType").asText("");
		dispatchToLambda(body, mealOrderId, pidgeOrderId, customerId, vendorId, eventType, recipientType);
	}

	private ObjectNode buildBody(
			MealOrderContext ctx,
			UUID mealOrderId,
			DeliveryTracking dt,
			String pidgeOrderId,
			String eventType,
			String recipientType,
			UUID recipientId) {
		ObjectNode body = objectMapper.createObjectNode();
		body.put("recipientId", recipientId.toString());
		body.put("recipientType", recipientType);
		body.put("orderId", mealOrderId.toString());
		body.put("eventType", eventType);
		if (ctx.orderNumber() != null) {
			body.put("orderNumber", ctx.orderNumber());
		}
		if (ctx.vendorName() != null) {
			body.put("vendorName", ctx.vendorName());
		}
		if (ctx.customerName() != null) {
			body.put("customerName", ctx.customerName());
		}
		if (dt.getDeliveryPersonName() != null) {
			body.put("riderName", dt.getDeliveryPersonName());
		}
		if (dt.getId() != null) {
			body.put("deliveryTrackingId", dt.getId().toString());
		}
		if (pidgeOrderId != null && !pidgeOrderId.isBlank()) {
			body.put("pidgeOrderId", pidgeOrderId);
		}
		if (dt.getStatus() != null) {
			body.put("logisticsStatus", dt.getStatus());
		}
		return body;
	}

	private UUID resolveMealOrderIdForSubscription(UUID subscriptionDeliveryId) {
		try {
			return jdbc.queryForObject(
					"""
							SELECT id FROM meal_orders
							WHERE purchase_snapshot IS NOT NULL
							  AND purchase_snapshot->>'canonicalDeliveryId' = ?
							LIMIT 1
							""",
					UUID.class,
					subscriptionDeliveryId.toString());
		} catch (Exception e) {
			return null;
		}
	}

	private String mapCustomerRiderEventType(String normalized, String deliveryTrackingStatus) {
		String n = normalized != null ? normalized.trim().toLowerCase(Locale.ROOT) : "";
		String dt = deliveryTrackingStatus != null ? deliveryTrackingStatus.trim().toLowerCase(Locale.ROOT) : "";

		if ("delivered".equals(n) || "delivered".equals(dt)) {
			return "meal_order_delivered";
		}
		if ("nearby".equals(n) || "nearby".equals(dt)) {
			return "meal_rider_nearby";
		}
		if ("picked_up".equals(n) || "picked_up".equals(dt)) {
			return "meal_order_pickup";
		}
		if ("in_transit".equals(n) || "out_for_delivery".equals(n) || "on_the_way".equals(dt)) {
			return "meal_rider_on_the_way";
		}
		if ("pending_assignment".equals(n)
				|| "assigned".equals(n)
				|| "awb_generated".equals(n)
				|| "pickup_scheduled".equals(n)
				|| "pending".equals(n)
				|| "heading_to_pickup".equals(dt)) {
			return "meal_rider_assigned";
		}
		if ("cancelled".equals(n) || "failed".equals(n) || "lost".equals(n) || "damaged".equals(n) || "failed".equals(dt)) {
			return "meal_logistics_cancelled";
		}
		return null;
	}

	private String mapVendorRiderEventType(String normalized, String deliveryTrackingStatus) {
		String n = normalized != null ? normalized.trim().toLowerCase(Locale.ROOT) : "";
		String dt = deliveryTrackingStatus != null ? deliveryTrackingStatus.trim().toLowerCase(Locale.ROOT) : "";

		if ("cancelled".equals(n) || "failed".equals(n) || "lost".equals(n) || "damaged".equals(n) || "failed".equals(dt)) {
			return "vendor_meal_delivery_failed";
		}
		if ("delivered".equals(n) || "delivered".equals(dt)) {
			return "vendor_meal_order_delivered";
		}
		if ("picked_up".equals(n) || "picked_up".equals(dt)) {
			return "vendor_meal_rider_picked_up";
		}
		if ("pending_assignment".equals(n)
				|| "assigned".equals(n)
				|| "awb_generated".equals(n)
				|| "pickup_scheduled".equals(n)
				|| "pending".equals(n)
				|| "in_transit".equals(n)
				|| "out_for_delivery".equals(n)
				|| "nearby".equals(n)
				|| "heading_to_pickup".equals(dt)
				|| "on_the_way".equals(dt)
				|| "nearby".equals(dt)) {
			return "vendor_meal_rider_assigned";
		}
		return null;
	}

	private MealOrderContext loadMealOrderContext(UUID mealOrderId) {
		try {
			Map<String, Object> row = jdbc.queryForMap(
					"""
							SELECT mo.customer_id, mo.vendor_id, mo.order_number,
							       v.business_name AS vendor_name,
							       COALESCE(NULLIF(TRIM(c.full_name), ''), 'Customer') AS customer_name
							FROM meal_orders mo
							LEFT JOIN vendors v ON v.id = mo.vendor_id
							LEFT JOIN customers c ON c.id = mo.customer_id
							WHERE mo.id = ?
							LIMIT 1
							""",
					mealOrderId);
			Object customerObj = row.get("customer_id");
			Object vendorObj = row.get("vendor_id");
			if (customerObj == null || vendorObj == null) {
				return null;
			}
			UUID customerId = customerObj instanceof UUID u ? u : UUID.fromString(String.valueOf(customerObj));
			UUID vendorId = vendorObj instanceof UUID u ? u : UUID.fromString(String.valueOf(vendorObj));
			String orderNumber = row.get("order_number") != null ? String.valueOf(row.get("order_number")) : null;
			String vendorName = row.get("vendor_name") != null ? String.valueOf(row.get("vendor_name")) : null;
			String customerName = row.get("customer_name") != null ? String.valueOf(row.get("customer_name")) : null;
			return new MealOrderContext(customerId, vendorId, orderNumber, vendorName, customerName);
		} catch (Exception e) {
			log.warn("[meal-delivery-notify] loadMealOrderContext failed for {}: {}", mealOrderId, e.getMessage());
			return null;
		}
	}

	private void dispatchToLambda(
			ObjectNode body,
			UUID mealOrderId,
			String pidgeOrderId,
			UUID customerId,
			UUID vendorId,
			String eventType,
			String recipientType) {
		String base = properties.getApiBaseUrl() != null ? properties.getApiBaseUrl().trim() : "";
		String secret = properties.getSecret() != null ? properties.getSecret().trim() : "";
		if (base.isEmpty() || secret.isEmpty()) {
			log.warn(
					"[PIDGE CANCEL NOTIFY] skipped — meal-delivery-notify not configured mealOrderId={} pidgeOrderId={} eventType={} recipientType={} customerId={} vendorId={} apiBaseUrlConfigured={} secretConfigured={}",
					mealOrderId,
					pidgeOrderId,
					eventType,
					recipientType,
					customerId,
					vendorId,
					!base.isEmpty(),
					!secret.isEmpty());
			return;
		}
		String url = base.replaceAll("/$", "") + "/internal/meal-delivery/notify";
		HttpHeaders headers = new HttpHeaders();
		headers.setContentType(MediaType.APPLICATION_JSON);
		headers.set("X-Meal-Delivery-Notify-Secret", secret);
		try {
			ResponseEntity<String> resp = restTemplate.postForEntity(
					url, new HttpEntity<>(body.toString(), headers), String.class);
			log.info(
					"[PIDGE CANCEL NOTIFY] Lambda mealOrderId={} pidgeOrderId={} eventType={} recipientType={} customerId={} vendorId={} httpStatus={} body={}",
					mealOrderId,
					pidgeOrderId,
					eventType,
					recipientType,
					customerId,
					vendorId,
					resp.getStatusCode().value(),
					truncateForLog(resp.getBody(), 500));
		} catch (RestClientException e) {
			log.warn(
					"[PIDGE CANCEL NOTIFY] Lambda call failed mealOrderId={} pidgeOrderId={} eventType={} recipientType={} url={} error={}",
					mealOrderId,
					pidgeOrderId,
					eventType,
					recipientType,
					url,
					e.getMessage());
		}
	}

	private static String truncateForLog(String value, int maxLen) {
		if (value == null) {
			return "";
		}
		return value.length() <= maxLen ? value : value.substring(0, maxLen) + "…";
	}

	private record MealOrderContext(
			UUID customerId,
			UUID vendorId,
			String orderNumber,
			String vendorName,
			String customerName) {}

	@Transactional(propagation = Propagation.REQUIRES_NEW)
	public void notifyMealRiderReassignPending(DeliveryTracking dt, String pidgeOrderId) {
		notifyReassignEvent(dt, pidgeOrderId, "meal_rider_reassign_pending", "vendor_meal_rider_reassign_pending");
	}

	@Transactional(propagation = Propagation.REQUIRES_NEW)
	public void notifyMealRiderReassigned(DeliveryTracking dt, String pidgeOrderId, String newRiderName) {
		if (newRiderName != null && !newRiderName.isBlank() && dt != null) {
			dt.setDeliveryPersonName(newRiderName);
		}
		notifyReassignEvent(dt, pidgeOrderId, "meal_rider_reassigned", "vendor_meal_rider_reassigned");
	}

	private void notifyReassignEvent(
			DeliveryTracking dt,
			String pidgeOrderId,
			String customerEvent,
			String vendorEvent) {
		if (dt == null) {
			return;
		}
		UUID mealOrderId = dt.getMealOrderId();
		if (mealOrderId == null && dt.getSubscriptionDeliveryId() != null) {
			mealOrderId = resolveMealOrderIdForSubscription(dt.getSubscriptionDeliveryId());
		}
		if (mealOrderId == null) {
			return;
		}
		MealOrderContext ctx = loadMealOrderContext(mealOrderId);
		if (ctx == null) {
			return;
		}
		if (ctx.customerId() != null) {
			dispatchMealNotify(
					buildBody(ctx, mealOrderId, dt, pidgeOrderId, customerEvent, "customer", ctx.customerId()),
					mealOrderId,
					pidgeOrderId,
					ctx.customerId(),
					ctx.vendorId());
		}
		if (ctx.vendorId() != null) {
			dispatchMealNotify(
					buildBody(ctx, mealOrderId, dt, pidgeOrderId, vendorEvent, "vendor", ctx.vendorId()),
					mealOrderId,
					pidgeOrderId,
					ctx.customerId(),
					ctx.vendorId());
		}
	}
}
