package com.warmpawz.delivery.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.warmpawz.delivery.mapper.ShiprocketAdhocMapper;
import com.warmpawz.delivery.service.ExternalPartnerLogisticsService;
import com.warmpawz.delivery.service.PidgeIntegrationService;
import com.warmpawz.delivery.service.ShipmentService;
import com.warmpawz.delivery.util.PidgeOrderIdMap;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Parity with Lambda {@code logistics.ts} HTTP routes (partner APIs + Pidge).
 */
@RestController
@RequiredArgsConstructor
@Tag(name = "Logistics")
public class LogisticsController {

	private final ExternalPartnerLogisticsService partners;
	private final PidgeIntegrationService pidge;
	private final ShipmentService shipmentService;
	private final ObjectMapper objectMapper;
	private final JdbcTemplate jdbc;

	@PostMapping("/logistics/shiprocket/create-order")
	public ResponseEntity<Map<String, Object>> shiprocketCreate(@RequestBody JsonNode body) throws Exception {
		ObjectNode payload = ShiprocketAdhocMapper.toAdhocPayload(body, objectMapper);
		JsonNode result = partners.shiprocketCreateAdhoc(payload);
		String orderId = body.path("orderId").asText("");
		shipmentService.recordShiprocketShipmentFromResponse(orderId, result);
		return ResponseEntity.ok(Map.of("success", true, "shipment", objectMapper.convertValue(result, Map.class)));
	}

	@GetMapping("/logistics/shiprocket/track/{shipmentId}")
	public ResponseEntity<Map<String, Object>> shiprocketTrack(@PathVariable String shipmentId) throws Exception {
		JsonNode t = partners.shiprocketTrackShipment(shipmentId);
		return ResponseEntity.ok(Map.of("success", true, "tracking", objectMapper.convertValue(t, Map.class)));
	}

	@PostMapping("/logistics/shiprocket/generate-awb")
	public ResponseEntity<Map<String, Object>> shiprocketAwb(@RequestBody JsonNode body) throws Exception {
		JsonNode r = partners.shiprocketGenerateAwb(body);
		return ResponseEntity.ok(Map.of("success", true, "result", objectMapper.convertValue(r, Map.class)));
	}

	@PostMapping("/logistics/pidge/create-order")
	public ResponseEntity<Map<String, Object>> pidgeCreate(@RequestBody JsonNode body) throws Exception {
		JsonNode json = pidge.createOrder(body);
		Map<String, String> idMap = PidgeOrderIdMap.extract(json);
		String firstSource = idMap.keySet().stream().findFirst().orElse(null);
		String firstPidgeId = firstSource != null ? idMap.get(firstSource) : null;
		if (firstSource != null && firstPidgeId != null) {
			shipmentService.recordPidgeShipmentIfResolvable(firstSource, firstPidgeId);
		}
		Map<String, Object> out = new LinkedHashMap<>();
		out.put("success", true);
		out.put("pidge", objectMapper.convertValue(json, Map.class));
		out.put("orderIdMap", idMap);
		if (firstPidgeId != null) {
			out.put("pidgeOrderId", firstPidgeId);
		}
		return ResponseEntity.ok(out);
	}

	@GetMapping("/logistics/pidge/order/{id}")
	public ResponseEntity<Map<String, Object>> pidgeGet(@PathVariable String id) throws Exception {
		JsonNode json = pidge.getOrderStatus(id);
		return ResponseEntity.ok(Map.of("success", true, "pidge", objectMapper.convertValue(json, Map.class)));
	}

	@PostMapping("/logistics/pidge/order/{id}/cancel")
	public ResponseEntity<Map<String, Object>> pidgeCancel(@PathVariable String id, @RequestBody(required = false) JsonNode body)
			throws Exception {
		JsonNode json = pidge.cancelOrder(id, body);
		shipmentService.markPidgeShipmentCancelled(id.trim());
		return ResponseEntity.ok(Map.of("success", true, "pidge", objectMapper.convertValue(json, Map.class)));
	}

	@PostMapping("/logistics/delhivery/create-order")
	public ResponseEntity<Map<String, Object>> delhiveryCreate(@RequestBody JsonNode body) throws Exception {
		JsonNode r = partners.delhiveryCreateOrder(body);
		return ResponseEntity.ok(Map.of("success", true, "result", objectMapper.convertValue(r, Map.class)));
	}

	@GetMapping("/logistics/delhivery/track/{waybill}")
	public ResponseEntity<Map<String, Object>> delhiveryTrack(@PathVariable String waybill) throws Exception {
		JsonNode r = partners.delhiveryTrack(waybill);
		return ResponseEntity.ok(Map.of("success", true, "tracking", objectMapper.convertValue(r, Map.class)));
	}

	@PostMapping("/logistics/delhivery/cancel")
	public ResponseEntity<Map<String, Object>> delhiveryCancel(@RequestBody JsonNode body) throws Exception {
		String waybill = body.path("waybill").asText(null);
		if (waybill == null || waybill.isBlank()) {
			return ResponseEntity.badRequest().body(Map.of("error", "waybill is required"));
		}
		partners.delhiveryCancelWaybill(waybill);
		jdbc.update(
				"UPDATE shipments SET status = 'cancelled', updated_at = NOW() WHERE awb_code = ? AND logistics_partner = 'delhivery'",
				waybill);
		return ResponseEntity.ok(Map.of("success", true, "message", "Shipment cancelled"));
	}

	@PostMapping("/logistics/dunzo/create-task")
	public ResponseEntity<Map<String, Object>> dunzoCreate(@RequestBody JsonNode body) throws Exception {
		JsonNode r = partners.dunzoCreateTask(body);
		return ResponseEntity.ok(Map.of("success", true, "result", objectMapper.convertValue(r, Map.class)));
	}

	@GetMapping("/logistics/dunzo/task/{taskId}")
	public ResponseEntity<Map<String, Object>> dunzoTask(@PathVariable String taskId) throws Exception {
		JsonNode r = partners.dunzoGetTask(taskId);
		return ResponseEntity.ok(Map.of("success", true, "task", objectMapper.convertValue(r, Map.class)));
	}

	@PostMapping("/logistics/dunzo/cancel-task")
	public ResponseEntity<Map<String, Object>> dunzoCancel(@RequestBody JsonNode body) throws Exception {
		String taskId = body.path("taskId").asText(null);
		if (taskId == null || taskId.isBlank()) {
			return ResponseEntity.badRequest().body(Map.of("error", "taskId is required"));
		}
		partners.dunzoCancelTask(taskId);
		jdbc.update(
				"UPDATE delivery_tracking SET status = 'cancelled', updated_at = NOW() WHERE external_task_id = ? OR metadata->>'dunzo_task_id' = ?",
				taskId, taskId);
		return ResponseEntity.ok(Map.of("success", true, "message", "Task cancelled"));
	}

	@PostMapping("/logistics/calculate-shipping")
	public ResponseEntity<Map<String, Object>> calculateShippingNotImplemented() {
		return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED)
				.body(Map.of("error", "calculate-shipping is not implemented in delivery-service; use Lambda or extend Partner APIs."));
	}

	@PostMapping("/logistics/create-shipment")
	public ResponseEntity<Map<String, Object>> unifiedCreateNotImplemented() {
		return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED)
				.body(Map.of("error", "Unified create-shipment is not implemented; call /logistics/shiprocket/create-order, delhivery, dunzo, or pidge directly."));
	}

	@PostMapping("/logistics/cancel-order")
	public ResponseEntity<Map<String, Object>> cancelOrderNotImplemented() {
		return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED)
				.body(Map.of("error", "Unified cancel-order not implemented."));
	}

	@GetMapping("/logistics/track/{param}")
	public ResponseEntity<Map<String, Object>> unifiedTrackNotImplemented() {
		return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED)
				.body(Map.of("error", "Unified track not implemented; use partner-specific track endpoints."));
	}
}
