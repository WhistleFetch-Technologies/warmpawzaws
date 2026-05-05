package com.warmpawz.delivery.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;

/**
 * Updates pharmacy / meal order rows without full JPA models (monolith parity for tracking flow).
 */
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
		jdbc.update(
				"UPDATE meal_orders SET status = ?, updated_at = NOW() WHERE id = ?",
				status,
				orderId);
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
}
