package com.warmpawz.delivery.service;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.Map;
import java.util.UUID;

/**
 * Parity with Lambda {@code delivery-tracking.ts}.
 */
public interface DeliveryTrackingService {

	Map<String, Object> assignDelivery(UUID pharmacyOrderId, UUID mealOrderId, UUID deliveryPartnerId,
			String deliveryPersonName, String deliveryPersonPhone, String deliveryPersonPhoto, String vehicleNumber);

	Map<String, Object> updateStatus(UUID trackingId, String status, String notes);

	Map<String, Object> updateLocation(UUID trackingId, double lat, double lng,
			Double accuracy, Double speed, Integer heading,
			Integer etaMinutes, Double distanceRemaining);

	Map<String, Object> verifyOtp(UUID trackingId, String otp, String deliveryPhoto, String recipientName, String notes);

	Map<String, Object> getTrackingDetails(UUID trackingId);

	Map<String, Object> getTrackingByOrder(String orderType, UUID orderId);

	Map<String, Object> listPartnerOrders(String partnerId, String partnerPhone, String status);

	Map<String, Object> partnerEarnings(UUID partnerId, String period);

	Map<String, Object> listAvailableOrders();

	Map<String, Object> acceptOrder(UUID orderId, String orderType, String partnerId,
			String partnerName, String partnerPhone, String vehicleNumber);

	Map<String, Object> createTestCourierPartner(JsonNode body);
}
