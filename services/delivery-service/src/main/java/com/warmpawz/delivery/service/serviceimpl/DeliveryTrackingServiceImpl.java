package com.warmpawz.delivery.service.serviceimpl;

import com.fasterxml.jackson.databind.JsonNode;
import com.warmpawz.delivery.entity.CourierPartner;
import com.warmpawz.delivery.entity.DeliveryLocationHistory;
import com.warmpawz.delivery.entity.DeliveryTracking;
import com.warmpawz.delivery.repository.CourierPartnerRepository;
import com.warmpawz.delivery.repository.DeliveryLocationHistoryRepository;
import com.warmpawz.delivery.repository.DeliveryTrackingRepository;
import com.warmpawz.delivery.service.DeliveryTrackingService;
import com.warmpawz.delivery.service.OrderStatusJdbcService;
import com.warmpawz.delivery.tracking.DeliveryTrackingEnrichmentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
public class DeliveryTrackingServiceImpl implements DeliveryTrackingService {

	private static final List<String> VALID_STATUSES = List.of(
			"assigned", "heading_to_pickup", "at_pickup",
			"picked_up", "on_the_way", "nearby", "delivered", "failed");

	private final DeliveryTrackingRepository deliveryTrackingRepository;
	private final DeliveryLocationHistoryRepository locationHistoryRepository;
	private final CourierPartnerRepository courierPartnerRepository;
	private final OrderStatusJdbcService orderStatusJdbc;
	private final JdbcTemplate jdbc;
	private final DeliveryTrackingEnrichmentService trackingEnrichmentService;

	@Override
	@Transactional
	public Map<String, Object> assignDelivery(UUID pharmacyOrderId, UUID mealOrderId, UUID deliveryPartnerId,
			String deliveryPersonName, String deliveryPersonPhone, String deliveryPersonPhoto, String vehicleNumber) {
		validateSingleOrder(pharmacyOrderId, mealOrderId);
		String otp = String.valueOf(1000 + new Random().nextInt(9000));

		DeliveryTracking t = new DeliveryTracking();
		if (pharmacyOrderId != null) {
			t.setPharmacyOrderId(pharmacyOrderId);
		} else {
			t.setMealOrderId(mealOrderId);
		}
		t.setLogisticsPartnerId(deliveryPartnerId);
		t.setDeliveryPersonName(deliveryPersonName);
		t.setDeliveryPersonPhone(deliveryPersonPhone);
		t.setDeliveryPersonPhoto(deliveryPersonPhoto);
		t.setVehicleNumber(vehicleNumber);
		t.setStatus("assigned");
		t.setDeliveryOtp(otp);
		t.setAssignedAt(Instant.now());
		t = deliveryTrackingRepository.save(t);

		if (pharmacyOrderId != null) {
			orderStatusJdbc.updatePharmacyOrderStatus(pharmacyOrderId, "ready_for_pickup");
		} else {
			orderStatusJdbc.updateMealOrderStatus(mealOrderId, "ready_for_pickup");
		}

		return Map.of("success", true, "tracking", entityToMap(t), "deliveryOtp", otp,
				"message", "Delivery partner assigned");
	}

	@Override
	@Transactional
	public Map<String, Object> updateStatus(UUID trackingId, String status, String notes) {
		DeliveryTracking t = deliveryTrackingRepository.findById(trackingId)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tracking not found"));
		String normalized = status == null ? "" : status.trim().toLowerCase(Locale.ROOT);
		if (!VALID_STATUSES.contains(normalized)) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid status");
		}
		t.setStatus(normalized);
		if ("at_pickup".equals(normalized)) {
			t.setReachedPickupAt(Instant.now());
		}
		if ("picked_up".equals(normalized)) {
			t.setPickedUpAt(Instant.now());
		}
		if ("delivered".equals(normalized)) {
			t.setDeliveredAt(Instant.now());
		}
		deliveryTrackingRepository.save(t);

		if (t.getPharmacyOrderId() != null) {
			orderStatusJdbc.updatePharmacyOrderStatus(t.getPharmacyOrderId(), normalized);
		} else if (t.getMealOrderId() != null) {
			orderStatusJdbc.updateMealOrderStatus(t.getMealOrderId(), normalized);
		}

		return Map.of("success", true, "message", "Status updated to " + normalized, "status", normalized);
	}

	@Override
	@Transactional
	public Map<String, Object> updateLocation(UUID trackingId, double lat, double lng,
			Double accuracy, Double speed, Integer heading,
			Integer etaMinutes, Double distanceRemaining) {
		DeliveryTracking t = deliveryTrackingRepository.findById(trackingId)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tracking not found"));
		t.setCurrentLat(BigDecimal.valueOf(lat));
		t.setCurrentLng(BigDecimal.valueOf(lng));
		t.setLastLocationUpdate(Instant.now());
		if (etaMinutes != null) {
			t.setEtaToDeliveryMinutes(etaMinutes);
		}
		if (distanceRemaining != null) {
			t.setDistanceRemainingKm(BigDecimal.valueOf(distanceRemaining));
		}
		deliveryTrackingRepository.save(t);

		DeliveryLocationHistory h = new DeliveryLocationHistory();
		h.setTrackingId(trackingId);
		h.setLat(BigDecimal.valueOf(lat));
		h.setLng(BigDecimal.valueOf(lng));
		if (accuracy != null) {
			h.setAccuracyMeters(BigDecimal.valueOf(accuracy));
		}
		if (speed != null) {
			h.setSpeedKmh(BigDecimal.valueOf(speed));
		}
		h.setHeading(heading);
		h.setSource("partner_app");
		locationHistoryRepository.save(h);

		return Map.of("success", true, "message", "Location updated");
	}

	@Override
	@Transactional
	public Map<String, Object> verifyOtp(UUID trackingId, String otp, String deliveryPhoto, String recipientName, String notes) {
		DeliveryTracking t = deliveryTrackingRepository.findById(trackingId)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tracking not found"));
		if (t.getDeliveryOtp() == null || !t.getDeliveryOtp().equals(otp)) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid OTP");
		}
		t.setStatus("delivered");
		t.setDeliveredAt(Instant.now());
		t.setDeliveryPhoto(deliveryPhoto);
		t.setRecipientName(recipientName);
		t.setDeliveryNotes(notes);
		t.setOtpVerified(true);
		deliveryTrackingRepository.save(t);

		if (t.getPharmacyOrderId() != null) {
			orderStatusJdbc.updatePharmacyOrderDelivered(t.getPharmacyOrderId());
		} else if (t.getMealOrderId() != null) {
			orderStatusJdbc.updateMealOrderDelivered(t.getMealOrderId());
		}

		return Map.of("success", true, "message", "Delivery completed successfully");
	}

	@Override
	@Transactional(readOnly = true)
	public Map<String, Object> getTrackingDetails(UUID trackingId) {
		DeliveryTracking t = deliveryTrackingRepository.findById(trackingId)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tracking not found"));
		var rows = jdbc.query(
				"SELECT lat, lng, recorded_at FROM delivery_location_history WHERE tracking_id = ? ORDER BY recorded_at DESC LIMIT 50",
				(rs, i) -> Map.of(
						"lat", rs.getBigDecimal("lat"),
						"lng", rs.getBigDecimal("lng"),
						"recorded_at", rs.getTimestamp("recorded_at") != null ? rs.getTimestamp("recorded_at").toInstant().toString() : null),
				trackingId);
		Map<String, Object> tracking = buildTrackingPayload(t);
		trackingEnrichmentService.enrichIfApplicable(t).ifPresent(en -> trackingEnrichmentService.mergeIntoTrackingMap(tracking, en));
		return Map.of("success", true, "tracking", tracking, "locationHistory", rows);
	}

	@Override
	@Transactional(readOnly = true)
	public Map<String, Object> getTrackingByOrder(String orderType, UUID orderId) {
		List<DeliveryTracking> list = "pharmacy".equalsIgnoreCase(orderType)
				? deliveryTrackingRepository.findByPharmacyOrderIdOrderByCreatedAtDesc(orderId)
				: deliveryTrackingRepository.findByMealOrderIdOrderByCreatedAtDesc(orderId);
		if (list.isEmpty()) {
			throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Tracking not found");
		}
		DeliveryTracking t = list.get(0);
		Map<String, Object> tracking = buildTrackingPayload(t);
		trackingEnrichmentService.enrichIfApplicable(t).ifPresent(en -> trackingEnrichmentService.mergeIntoTrackingMap(tracking, en));
		return Map.of("success", true, "tracking", tracking);
	}

	@Override
	@Transactional(readOnly = true)
	public Map<String, Object> listPartnerOrders(String partnerId, String partnerPhone, String status) {
		String statusClause = "";
		if (status == null || "active".equalsIgnoreCase(status)) {
			statusClause = "AND dt.status NOT IN ('delivered', 'failed')";
		} else if (!"all".equalsIgnoreCase(status)) {
			statusClause = "AND dt.status = '" + status.replace("'", "''") + "'";
		}
		String sql = """
				SELECT dt.*, po.order_number as pharmacy_order_number, po.total_amount as pharmacy_total,
				       mo.order_number as meal_order_number, mo.total_amount as meal_total
				FROM delivery_tracking dt
				LEFT JOIN pharmacy_orders po ON dt.pharmacy_order_id = po.id
				LEFT JOIN meal_orders mo ON dt.meal_order_id = mo.id
				WHERE (dt.logistics_partner_id::text = ? OR dt.delivery_person_phone = ?)
				""" + statusClause + " ORDER BY dt.created_at DESC";
		List<Map<String, Object>> orders = jdbc.queryForList(sql, partnerId, partnerPhone != null ? partnerPhone : "");
		List<Map<String, Object>> simplified = new ArrayList<>();
		for (Map<String, Object> row : orders) {
			simplified.add(Map.of(
					"trackingId", row.get("id"),
					"orderType", row.get("pharmacy_order_id") != null ? "pharmacy" : "meal",
					"orderNumber", row.get("pharmacy_order_number") != null ? row.get("pharmacy_order_number") : row.get("meal_order_number"),
					"totalAmount", row.get("pharmacy_total") != null ? row.get("pharmacy_total") : row.get("meal_total"),
					"status", row.get("status"),
					"deliveryOtp", row.get("delivery_otp"),
					"assignedAt", row.get("assigned_at")));
		}
		return Map.of("success", true, "orders", simplified, "count", simplified.size());
	}

	@Override
	@Transactional(readOnly = true)
	public Map<String, Object> partnerEarnings(UUID partnerId, String period) {
		String dateFilter = switch (period == null ? "today" : period) {
			case "week" -> "AND dt.delivered_at >= NOW() - INTERVAL '7 days'";
			case "month" -> "AND dt.delivered_at >= NOW() - INTERVAL '30 days'";
			default -> "AND DATE(dt.delivered_at) = CURRENT_DATE";
		};
		String sql = """
				SELECT COUNT(*) as total_deliveries,
				       SUM(COALESCE(po.delivery_fee, 0) + COALESCE(mo.delivery_fee, 0)) as total_delivery_fees
				FROM delivery_tracking dt
				LEFT JOIN pharmacy_orders po ON dt.pharmacy_order_id = po.id
				LEFT JOIN meal_orders mo ON dt.meal_order_id = mo.id
				WHERE dt.logistics_partner_id = ? AND dt.status = 'delivered' """ + dateFilter;
		Map<String, Object> row = jdbc.queryForMap(sql, partnerId);
		return Map.of("success", true, "earnings", Map.of(
				"period", period,
				"totalDeliveries", ((Number) row.getOrDefault("total_deliveries", 0)).intValue(),
				"totalEarnings", row.get("total_delivery_fees") != null ? ((Number) row.get("total_delivery_fees")).doubleValue() : 0.0));
	}

	@Override
	@Transactional(readOnly = true)
	public Map<String, Object> listAvailableOrders() {
		String sql = """
				SELECT po.id::text as id, po.order_number::text as order_number,
				       COALESCE(po.total_amount::text, '0') as total_amount,
				       COALESCE(po.delivery_fee::text, '0') as delivery_fee,
				       po.delivery_address::text as delivery_address,
				       po.payment_method::text as payment_method,
				       po.created_at, 'pharmacy'::text as order_type,
				       COALESCE(v.business_name::text, '') as vendor_name
				FROM pharmacy_orders po
				JOIN vendors v ON po.pharmacy_id = v.id
				WHERE po.status = 'ready_for_pickup' AND po.logistics_type = 'warmpawz' AND po.logistics_partner_id IS NULL
				UNION ALL
				SELECT mo.id::text as id, mo.order_number::text as order_number,
				       COALESCE(mo.total_amount::text, '0') as total_amount,
				       COALESCE(mo.delivery_fee::text, '0') as delivery_fee,
				       mo.delivery_address::text as delivery_address,
				       'online'::text as payment_method,
				       mo.created_at, 'meal'::text as order_type,
				       COALESCE(v.business_name::text, '') as vendor_name
				FROM meal_orders mo
				JOIN vendors v ON mo.vendor_id = v.id
				WHERE mo.status = 'ready_for_pickup' AND mo.logistics_type = 'warmpawz' AND mo.logistics_partner_id IS NULL
				ORDER BY created_at DESC LIMIT 20
				""";
		List<Map<String, Object>> rows = jdbc.queryForList(sql);
		return Map.of("success", true, "availableOrders", rows);
	}

	@Override
	@Transactional
	public Map<String, Object> acceptOrder(UUID orderId, String orderType, String partnerId,
			String partnerName, String partnerPhone, String vehicleNumber) {
		String table = "pharmacy".equalsIgnoreCase(orderType) ? "pharmacy_orders" : "meal_orders";
		List<Map<String, Object>> orderRows = jdbc.queryForList("SELECT id, logistics_partner_id FROM " + table + " WHERE id = ?", orderId);
		if (orderRows.isEmpty()) {
			throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found");
		}
		if (orderRows.get(0).get("logistics_partner_id") != null) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, "Order already assigned");
		}
		String otp = String.valueOf(1000 + new Random().nextInt(9000));
		UUID logisticsPartnerUuid = null;
		try {
			if (partnerId != null && partnerId.matches("(?i)[0-9a-f-]{36}")) {
				int c = jdbc.queryForObject("SELECT COUNT(*) FROM vendors WHERE id = ?", Integer.class, UUID.fromString(partnerId));
				if (c > 0) {
					logisticsPartnerUuid = UUID.fromString(partnerId);
				}
			}
		} catch (Exception ignored) {
		}
		String col = "pharmacy".equalsIgnoreCase(orderType) ? "pharmacy_order_id" : "meal_order_id";
		List<Map<String, Object>> existing = jdbc.queryForList(
				"SELECT id, logistics_partner_id FROM delivery_tracking WHERE " + col + " = ? ORDER BY created_at DESC LIMIT 1",
				orderId);

		if (!existing.isEmpty() && existing.get(0).get("logistics_partner_id") == null) {
			UUID tid = (UUID) existing.get(0).get("id");
			jdbc.update(
					"UPDATE delivery_tracking SET logistics_partner_id = ?, delivery_person_name = ?, "
							+ "delivery_person_phone = ?, vehicle_number = ?, status = 'heading_to_pickup', "
							+ "delivery_otp = ?, assigned_at = NOW() WHERE id = ?",
					logisticsPartnerUuid, partnerName, partnerPhone, vehicleNumber, otp, tid);
			DeliveryTracking saved = deliveryTrackingRepository.findById(tid).orElseThrow();
			return Map.of("success", true, "tracking", entityToMap(saved), "deliveryOtp", otp,
					"message", "Order accepted! Head to pickup location.");
		}

		DeliveryTracking t = new DeliveryTracking();
		if ("pharmacy".equalsIgnoreCase(orderType)) {
			t.setPharmacyOrderId(orderId);
		} else {
			t.setMealOrderId(orderId);
		}
		t.setLogisticsPartnerId(logisticsPartnerUuid);
		t.setDeliveryPersonName(partnerName);
		t.setDeliveryPersonPhone(partnerPhone);
		t.setVehicleNumber(vehicleNumber);
		t.setStatus("heading_to_pickup");
		t.setDeliveryOtp(otp);
		t.setAssignedAt(Instant.now());
		t = deliveryTrackingRepository.save(t);
		if (logisticsPartnerUuid != null) {
			if ("pharmacy".equalsIgnoreCase(orderType)) {
				orderStatusJdbc.updatePharmacyOrderPartner(orderId, logisticsPartnerUuid);
			} else {
				orderStatusJdbc.updateMealOrderPartner(orderId, logisticsPartnerUuid);
			}
		}
		return Map.of("success", true, "tracking", entityToMap(t), "deliveryOtp", otp,
				"message", "Order accepted! Head to pickup location.");
	}

	@Override
	@Transactional
	public Map<String, Object> createTestCourierPartner(JsonNode body) {
		String partnerId = body.hasNonNull("partnerId") ? body.get("partnerId").asText() : "test_partner_" + System.currentTimeMillis();
		String name = body.hasNonNull("name") ? body.get("name").asText() : "Test Delivery Partner";
		String phone = body.hasNonNull("phone") ? body.get("phone").asText() : "9876543210";
		String vehicleType = body.hasNonNull("vehicleType") ? body.get("vehicleType").asText() : "bike";
		String vehicleNumber = body.hasNonNull("vehicleNumber") ? body.get("vehicleNumber").asText() : "TEST-1234";
		UUID vendorId = body.hasNonNull("vendorId") ? UUID.fromString(body.get("vendorId").asText()) : null;

		CourierPartner p = new CourierPartner();
		p.setPartnerId(partnerId);
		p.setVendorId(vendorId);
		p.setName(name);
		p.setPhone(phone);
		p.setVehicleType(vehicleType);
		p.setVehicleNumber(vehicleNumber);
		p.setCurrentLocationJson("{\"lat\":12.9716,\"lng\":77.5946}");
		p.setStatus("available");
		p.setRating(BigDecimal.valueOf(5));
		p.setTotalDeliveries(0);
		p.setActive(true);
		try {
			p = courierPartnerRepository.save(p);
		} catch (Exception e) {
			return Map.of("success", true, "partner", Map.of("partner_id", partnerId), "partnerId", partnerId,
					"message", "Mock partner (DB insert failed): " + e.getMessage());
		}
		return Map.of("success", true, "partner", entityToMap(p), "partnerId", partnerId,
				"message", "Test delivery partner created.");
	}

	private static void validateSingleOrder(UUID pharmacyOrderId, UUID mealOrderId) {
		if ((pharmacyOrderId == null && mealOrderId == null) || (pharmacyOrderId != null && mealOrderId != null)) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Provide either pharmacyOrderId or mealOrderId, not both");
		}
	}

	private static String nullable(String s) {
		return s != null ? s : "";
	}

	private Map<String, Object> buildTrackingPayload(DeliveryTracking t) {
		Map<String, Object> deliveryPerson = new LinkedHashMap<>();
		deliveryPerson.put("name", nullable(t.getDeliveryPersonName()));
		deliveryPerson.put("phone", nullable(t.getDeliveryPersonPhone()));
		deliveryPerson.put("photo", nullable(t.getDeliveryPersonPhoto()));
		deliveryPerson.put("vehicleNumber", nullable(t.getVehicleNumber()));

		Map<String, Object> tracking = new LinkedHashMap<>();
		tracking.put("id", t.getId());
		tracking.put("status", t.getStatus());
		tracking.put("logisticsPartner", nullable(t.getLogisticsPartner()));
		tracking.put("deliveryPerson", deliveryPerson);
		if (t.getCurrentLat() != null && t.getCurrentLng() != null) {
			Map<String, Object> currentLocation = new LinkedHashMap<>();
			currentLocation.put("lat", t.getCurrentLat());
			currentLocation.put("lng", t.getCurrentLng());
			if (t.getLastLocationUpdate() != null) {
				currentLocation.put("updatedAt", t.getLastLocationUpdate().toString());
			}
			tracking.put("currentLocation", currentLocation);
			tracking.put("location", Map.of(
					"latitude", t.getCurrentLat().doubleValue(),
					"longitude", t.getCurrentLng().doubleValue()));
		}
		if (t.getEtaToDeliveryMinutes() != null) {
			tracking.put("eta", t.getEtaToDeliveryMinutes());
			tracking.put("etaMinutes", t.getEtaToDeliveryMinutes());
		}
		tracking.put("distanceRemaining", t.getDistanceRemainingKm());
		tracking.put("deliveryOtp", t.getDeliveryOtp());
		tracking.put("trackingUrl", t.getTrackingUrl());
		tracking.put("timestamps", Map.of(
				"assigned", t.getAssignedAt() != null ? t.getAssignedAt().toString() : null,
				"reachedPickup", t.getReachedPickupAt() != null ? t.getReachedPickupAt().toString() : null,
				"pickedUp", t.getPickedUpAt() != null ? t.getPickedUpAt().toString() : null,
				"delivered", t.getDeliveredAt() != null ? t.getDeliveredAt().toString() : null));
		return tracking;
	}

	private static Map<String, Object> entityToMap(DeliveryTracking t) {
		Map<String, Object> m = new LinkedHashMap<>();
		m.put("id", t.getId());
		m.put("status", t.getStatus());
		m.put("delivery_otp", t.getDeliveryOtp());
		m.put("pharmacy_order_id", t.getPharmacyOrderId());
		m.put("meal_order_id", t.getMealOrderId());
		return m;
	}

	private static Map<String, Object> entityToMap(CourierPartner p) {
		Map<String, Object> m = new LinkedHashMap<>();
		m.put("id", p.getId());
		m.put("partner_id", p.getPartnerId());
		return m;
	}
}
