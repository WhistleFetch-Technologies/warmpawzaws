package com.warmpawz.delivery.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Updates pharmacy / meal / ecommerce order rows without full JPA models (monolith parity for tracking flow).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OrderStatusJdbcService {

	private final JdbcTemplate jdbc;

	public void updatePharmacyOrderStatus(UUID orderId, String status) {
		jdbc.update(
				"UPDATE pharmacy_orders SET status = ?, updated_at = NOW() WHERE id = ?",
				status,
				orderId);
	}

	public void updatePharmacyOrderDelivered(UUID orderId) {
		jdbc.update(
				"UPDATE pharmacy_orders SET status = 'delivered', delivered_at = ?, updated_at = NOW() WHERE id = ?",
				Timestamp.from(Instant.now()),
				orderId);
	}

	public void updateMealOrderStatus(UUID orderId, String status) {
		if (status != null && "delivered".equalsIgnoreCase(status)) {
			jdbc.update(
					"UPDATE meal_orders SET status = ?, delivered_at = NOW(), updated_at = NOW() WHERE id = ?",
					status,
					orderId);
		} else {
			jdbc.update(
					"UPDATE meal_orders SET status = ?, updated_at = NOW() WHERE id = ?",
					status,
					orderId);
		}
	}

	public void updateMealOrderDelivered(UUID orderId) {
		jdbc.update(
				"UPDATE meal_orders SET status = 'delivered', delivered_at = ?, updated_at = NOW() WHERE id = ?",
				Timestamp.from(Instant.now()),
				orderId);
	}

	public void updatePharmacyOrderPartner(UUID orderId, UUID partnerId) {
		jdbc.update(
				"UPDATE pharmacy_orders SET logistics_partner_id = ?, updated_at = NOW() WHERE id = ?",
				partnerId,
				orderId);
	}

	public void updateMealOrderPartner(UUID orderId, UUID partnerId) {
		jdbc.update(
				"UPDATE meal_orders SET logistics_partner_id = ?, updated_at = NOW() WHERE id = ?",
				partnerId,
				orderId);
	}

	/**
	 * Maps normalized shipment status (Shiprocket-style keys) to ecommerce {@code orders.order_status}
	 * — parity with {@code updateOrderStatus} in monolith {@code logistics-webhooks.ts}.
	 */
	public void updateEcommerceOrderShipmentStatus(UUID orderId, String normalizedShipmentStatus) {
		String orderStatus = switch (normalizedShipmentStatus) {
			case "awb_generated", "pickup_scheduled" -> "processing";
			case "picked_up", "in_transit" -> "shipped";
			case "out_for_delivery" -> "out_for_delivery";
			case "delivered" -> "delivered";
			case "rto_initiated" -> "return_initiated";
			case "returned" -> "returned";
			case "cancelled" -> "cancelled";
			default -> "processing";
		};
		if ("delivered".equals(normalizedShipmentStatus)) {
			jdbc.update(
					"UPDATE orders SET order_status = ?, delivered_at = NOW(), updated_at = NOW() WHERE id = ?",
					orderStatus,
					orderId);
		} else {
			jdbc.update(
					"UPDATE orders SET order_status = ?, updated_at = NOW() WHERE id = ?",
					orderStatus,
					orderId);
		}
	}

	/**
	 * Canonical subscription sessions — parity with {@code resolve-meal-order-for-subscription-delivery.ts}.
	 */
	public UUID resolveMealOrderIdForSubscriptionDelivery(UUID subscriptionDeliveryId) {
		if (subscriptionDeliveryId == null) {
			return null;
		}
		String marker = "%__canonical_delivery_id__:" + subscriptionDeliveryId + "__%";
		try {
			UUID id = jdbc.queryForObject(
					"SELECT id FROM meal_orders WHERE special_instructions LIKE ? LIMIT 1",
					UUID.class,
					marker);
			return id;
		} catch (EmptyResultDataAccessException e) {
			// continue
		}
		try {
			return jdbc.queryForObject(
					"SELECT id FROM meal_orders WHERE purchase_snapshot IS NOT NULL "
							+ "AND purchase_snapshot->>'canonicalDeliveryId' = ? LIMIT 1",
					UUID.class,
					subscriptionDeliveryId.toString());
		} catch (EmptyResultDataAccessException e) {
			return null;
		}
	}

	/**
	 * Idempotent meal vendor settlement — parity with {@code meal-order-settlement.ts}.
	 * Runs in a new transaction so a settlement/schema failure cannot roll back delivery status updates
	 * in the caller's webhook transaction.
	 */
	@Transactional(propagation = Propagation.REQUIRES_NEW)
	public void ensureMealOrderSettlementOnDelivered(UUID mealOrderId) {
		try {
			List<java.util.Map<String, Object>> rows = jdbc.queryForList("SELECT * FROM meal_orders WHERE id = ?", mealOrderId);
			if (rows.isEmpty()) {
				return;
			}
			Object status = rows.get(0).get("status");
			if (status == null || !"delivered".equalsIgnoreCase(String.valueOf(status))) {
				return;
			}
			Integer dup = jdbc.queryForObject(
					"SELECT COUNT(*)::int FROM delivery_settlements WHERE meal_order_id = ? LIMIT 1",
					Integer.class,
					mealOrderId);
			if (dup != null && dup > 0) {
				return;
			}
			UUID vendorId = (UUID) rows.get(0).get("vendor_id");
			if (vendorId == null) {
				return;
			}

			VendorSettlementContext v = loadVendorSettlementContext(vendorId);
			double commissionRate = v.commissionRate();

			double orderAmount = toDouble(rows.get(0).get("total_amount"));
			if (!(orderAmount > 0)) {
				orderAmount = toDouble(rows.get(0).get("subtotal"));
			}
			if (!(orderAmount > 0)) {
				log.warn("[meal-order-settlement] Skip settlement for {}: no valid order amount", mealOrderId);
				return;
			}
			double deliveryFee = toDouble(rows.get(0).get("delivery_fee"));
			double platformFee = toDouble(rows.get(0).get("platform_fee"));
			double convenienceFee = toDouble(rows.get(0).get("convenience_fee"));
			String logisticsType = rows.get(0).get("logistics_type") != null
					? String.valueOf(rows.get(0).get("logistics_type"))
					: "";
			double logisticsCost =
					"warmpawz".equalsIgnoreCase(logisticsType) ? toDouble(rows.get(0).get("logistics_cost")) : 0.0;

			double commissionableAmount = orderAmount - deliveryFee - platformFee - convenienceFee;
			long commissionAmount = Math.round(commissionableAmount * (commissionRate / 100.0));
			long netPayout = Math.round(orderAmount - commissionAmount - platformFee - convenienceFee - logisticsCost);

			Integer tierLevelInt = null;
			if (v.tierLevel() instanceof Number n) {
				tierLevelInt = n.intValue();
			}
			jdbc.update(
					"""
							INSERT INTO delivery_settlements (
							  meal_order_id, vendor_id, order_amount, delivery_fee_collected, platform_fee,
							  convenience_fee, commission_rate, commission_amount, logistics_cost, net_payout,
							  status, order_delivered_at, tier_name, tier_level)
							VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW(), ?, ?)
							""",
					mealOrderId,
					vendorId,
					orderAmount,
					deliveryFee,
					platformFee,
					convenienceFee,
					commissionRate,
					commissionAmount,
					logisticsCost,
					netPayout,
					v.tierName(),
					tierLevelInt);
			log.info("Meal settlement created for order {} (commission {}%)", mealOrderId, commissionRate);
		} catch (Exception e) {
			log.error("[meal-order-settlement] Error creating settlement for {}: {}", mealOrderId, e.getMessage());
		}
	}

	private VendorSettlementContext loadVendorSettlementContext(UUID vendorId) {
		try {
			List<java.util.Map<String, Object>> rows = jdbc.queryForList(
					"""
							SELECT v.*,
							       v.commission_rate as vendor_commission_rate,
							       vt.commission_rate as tier_commission_rate,
							       vt.tier_name as tier_tier_name
							FROM vendors v
							LEFT JOIN vendor_tiers vt ON vt.is_active = true
							  AND (TRIM(LOWER(v.tier)) = TRIM(LOWER(vt.tier_name)))
							WHERE v.id = ?
							""",
					vendorId);
			if (rows.isEmpty()) {
				return new VendorSettlementContext(15.0, null, null);
			}
			var r = rows.get(0);
			Double tier = r.get("tier_commission_rate") != null ? toDouble(r.get("tier_commission_rate")) : null;
			Double ven = r.get("vendor_commission_rate") != null ? toDouble(r.get("vendor_commission_rate")) : null;
			double rate = 15.0;
			if (tier != null && !Double.isNaN(tier)) {
				rate = tier;
			} else if (ven != null && !Double.isNaN(ven)) {
				rate = ven;
			}
			String tierName = r.get("tier_tier_name") != null ? String.valueOf(r.get("tier_tier_name")) : null;
			Object tierLevel = r.get("tier_level");
			return new VendorSettlementContext(rate, tierName, tierLevel);
		} catch (Exception e) {
			log.warn("loadVendorSettlementContext failed: {}", e.getMessage());
			return new VendorSettlementContext(15.0, null, null);
		}
	}

	private static String escapeJson(String s) {
		if (s == null) {
			return "";
		}
		return s.replace("\\", "\\\\").replace("\"", "\\\"");
	}

	private static double toDouble(Object v) {
		if (v == null) {
			return 0.0;
		}
		double d;
		if (v instanceof BigDecimal b) {
			d = b.doubleValue();
		} else if (v instanceof Number n) {
			d = n.doubleValue();
		} else {
			try {
				d = Double.parseDouble(String.valueOf(v).replace(",", ""));
			} catch (NumberFormatException e) {
				return 0.0;
			}
		}
		return Double.isFinite(d) ? d : 0.0;
	}

	private record VendorSettlementContext(double commissionRate, String tierName, Object tierLevel) {}

	/**
	 * In-app notification for ecommerce order shipment — parity with {@code sendShipmentNotification} in monolith
	 * (uses canonical {@code notifications} columns).
	 */
	public void maybeInsertShipmentCustomerNotification(
			UUID orderId,
			String normalizedStatus,
			String previousStatus,
			String awb,
			String locationLine) {
		if (normalizedStatus != null && normalizedStatus.equals(previousStatus)) {
			return;
		}
		try {
			var orows = jdbc.queryForList(
					"SELECT customer_id, order_number FROM orders WHERE id = ? LIMIT 1",
					orderId);
			if (orows.isEmpty()) {
				return;
			}
			UUID customerId = (UUID) orows.get(0).get("customer_id");
			String orderNumber = orows.get(0).get("order_number") != null
					? String.valueOf(orows.get(0).get("order_number"))
					: "";
			if (customerId == null) {
				return;
			}
			List<java.util.Map<String, Object>> custs =
					jdbc.queryForList("SELECT phone FROM customers WHERE id = ? LIMIT 1", customerId);
			if (custs.isEmpty() || custs.get(0).get("phone") == null
					|| String.valueOf(custs.get(0).get("phone")).isBlank()) {
				return;
			}
			String message = switch (normalizedStatus) {
				case "picked_up" -> "Your order #" + orderNumber + " has been picked up and is on its way!";
				case "in_transit" -> "Your order #" + orderNumber + " is in transit"
						+ (locationLine != null && !locationLine.isBlank() ? (" - Currently at " + locationLine) : "")
						+ ".";
				case "out_for_delivery" ->
						"Your order #" + orderNumber + " is out for delivery! It will arrive soon.";
				case "delivered" ->
						"Your order #" + orderNumber + " has been delivered. Thank you for shopping with WarmPawz!";
				case "rto_initiated" -> "Your order #" + orderNumber + " is being returned to the seller.";
				default -> null;
			};
			if (message == null) {
				return;
			}
			String title = "delivered".equals(normalizedStatus) ? "📦 Order Delivered!" : "🚚 Shipment Update";
			String dataJson = "{\"orderId\":\"" + orderId + "\",\"orderNumber\":\"" + escapeJson(orderNumber)
					+ "\",\"status\":\"" + normalizedStatus + "\",\"awb\":\"" + escapeJson(awb != null ? awb : "")
					+ "\",\"trackingUrl\":\"https://warmpawz.com/track/" + orderId + "\"}";
			jdbc.update(
					"""
							INSERT INTO notifications (
							  recipient_type, recipient_id, notification_type, title, message, channels, is_read, data)
							VALUES ('customer', ?, 'shipment_update', ?, ?, '{"in_app":true}'::jsonb, false, ?::jsonb)
							""",
					customerId,
					title,
					message,
					dataJson);
		} catch (Exception e) {
			log.warn("maybeInsertShipmentCustomerNotification failed: {}", e.getMessage());
		}
	}
}
