package com.warmpawz.delivery.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.warmpawz.delivery.service.DeliveryTrackingService;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

/**
 * Parity with Lambda {@code delivery-tracking.ts}.
 */
@RestController
@RequiredArgsConstructor
@Tag(name = "Delivery tracking")
public class DeliveryController {

	private final DeliveryTrackingService deliveryTrackingService;

	@PostMapping("/delivery/assign")
	public ResponseEntity<Map<String, Object>> assign(@RequestBody JsonNode body) {
		UUID pharmacy = uuid(body, "pharmacyOrderId");
		UUID meal = uuid(body, "mealOrderId");
		UUID partnerId = uuid(body, "deliveryPartnerId");
		return ResponseEntity.ok(deliveryTrackingService.assignDelivery(
				pharmacy,
				meal,
				partnerId,
				text(body, "deliveryPersonName"),
				text(body, "deliveryPersonPhone"),
				text(body, "deliveryPersonPhoto"),
				text(body, "vehicleNumber")));
	}

	@PostMapping("/delivery/{trackingId}/update-status")
	public ResponseEntity<Map<String, Object>> updateStatus(
			@PathVariable UUID trackingId,
			@RequestBody JsonNode body) {
		return ResponseEntity.ok(deliveryTrackingService.updateStatus(
				trackingId,
				text(body, "status"),
				text(body, "notes")));
	}

	@PostMapping("/delivery/{trackingId}/update-location")
	public ResponseEntity<Map<String, Object>> updateLocation(
			@PathVariable UUID trackingId,
			@RequestBody JsonNode body) {
		return ResponseEntity.ok(deliveryTrackingService.updateLocation(
				trackingId,
				body.path("lat").asDouble(),
				body.path("lng").asDouble(),
				body.has("accuracy") ? body.get("accuracy").asDouble() : null,
				body.has("speed") ? body.get("speed").asDouble() : null,
				body.has("heading") ? body.get("heading").asInt() : null,
				body.has("etaMinutes") ? body.get("etaMinutes").asInt() : null,
				body.has("distanceRemaining") ? body.get("distanceRemaining").asDouble() : null));
	}

	@PostMapping("/delivery/{trackingId}/verify-otp")
	public ResponseEntity<Map<String, Object>> verifyOtp(
			@PathVariable UUID trackingId,
			@RequestBody JsonNode body) {
		return ResponseEntity.ok(deliveryTrackingService.verifyOtp(
				trackingId,
				text(body, "otp"),
				text(body, "deliveryPhoto"),
				text(body, "recipientName"),
				text(body, "notes")));
	}

	@GetMapping("/delivery/tracking/{trackingId}")
	public ResponseEntity<Map<String, Object>> getTracking(@PathVariable UUID trackingId) {
		return ResponseEntity.ok(deliveryTrackingService.getTrackingDetails(trackingId));
	}

	@GetMapping("/delivery/order/{orderType}/{orderId}")
	public ResponseEntity<Map<String, Object>> byOrder(@PathVariable String orderType, @PathVariable UUID orderId) {
		return ResponseEntity.ok(deliveryTrackingService.getTrackingByOrder(orderType, orderId));
	}

	@GetMapping("/delivery/partner/{partnerId}/orders")
	public ResponseEntity<Map<String, Object>> partnerOrders(
			@PathVariable String partnerId,
			@RequestParam(required = false, defaultValue = "9876543210") String phone,
			@RequestParam(required = false, defaultValue = "active") String status) {
		return ResponseEntity.ok(deliveryTrackingService.listPartnerOrders(partnerId, phone, status));
	}

	@GetMapping("/delivery/partner/{partnerId}/earnings")
	public ResponseEntity<Map<String, Object>> earnings(
			@PathVariable UUID partnerId,
			@RequestParam(required = false, defaultValue = "today") String period) {
		return ResponseEntity.ok(deliveryTrackingService.partnerEarnings(partnerId, period));
	}

	@GetMapping("/delivery/available/{partnerId}")
	public ResponseEntity<Map<String, Object>> available(@PathVariable String partnerId) {
		return ResponseEntity.ok(deliveryTrackingService.listAvailableOrders());
	}

	@PostMapping("/delivery/accept/{orderId}")
	public ResponseEntity<Map<String, Object>> accept(
			@PathVariable UUID orderId,
			@RequestBody JsonNode body) {
		return ResponseEntity.ok(deliveryTrackingService.acceptOrder(
				orderId,
				text(body, "orderType"),
				text(body, "partnerId"),
				text(body, "partnerName"),
				text(body, "partnerPhone"),
				text(body, "vehicleNumber")));
	}

	@PostMapping("/delivery/test/create-partner")
	public ResponseEntity<Map<String, Object>> createTestPartner(@RequestBody JsonNode body) {
		return ResponseEntity.ok(deliveryTrackingService.createTestCourierPartner(body));
	}

	private static String text(JsonNode n, String field) {
		return n != null && n.hasNonNull(field) ? n.get(field).asText() : null;
	}

	private static UUID uuid(JsonNode n, String field) {
		if (n == null || !n.hasNonNull(field)) {
			return null;
		}
		try {
			return UUID.fromString(n.get(field).asText());
		} catch (Exception e) {
			return null;
		}
	}
}
