package com.warmpawz.delivery.service.serviceimpl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.warmpawz.delivery.entity.DeliveryTracking;
import com.warmpawz.delivery.entity.Shipment;
import com.warmpawz.delivery.service.OrderStatusJdbcService;
import com.warmpawz.delivery.service.PidgePartialDeliverySupport;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Webhook side of Pidge Partial Delivery Workflow ({@code return_order_info} on forward DELIVERED).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PidgePartialDeliveryWebhookService {

	private final JdbcTemplate jdbc;
	private final ObjectMapper objectMapper;
	private final OrderStatusJdbcService orderStatusJdbc;

	public Optional<Map<String, Object>> tryHandleReturnOrderWebhook(
			String pidgeId, String ffStatusUpper, JsonNode payload) {
		if (pidgeId == null || pidgeId.isBlank()) {
			return Optional.empty();
		}
		var rows = jdbc.query(
				"""
						SELECT id, meal_order_id, pharmacy_order_id, workflow_status
						FROM pidge_partial_delivery_workflows
						WHERE return_pidge_order_id = ?
						LIMIT 1
						""",
				(rs, i) -> new WorkflowRow(
						rs.getObject("id", UUID.class),
						rs.getObject("meal_order_id", UUID.class),
						rs.getObject("pharmacy_order_id", UUID.class),
						rs.getString("workflow_status")),
				pidgeId.trim());
		if (rows.isEmpty()) {
			return Optional.empty();
		}
		WorkflowRow wf = rows.get(0);
		String payloadJson = writeJson(payload);
		jdbc.update(
				"""
						UPDATE pidge_partial_delivery_workflows
						SET last_webhook_payload = ?::jsonb, updated_at = NOW()
						WHERE id = ?
						""",
				payloadJson,
				wf.id());

		if (PidgePartialDeliverySupport.isReturnWorkflowComplete(ffStatusUpper)) {
			jdbc.update(
					"""
							UPDATE pidge_partial_delivery_workflows
							SET workflow_status = 'completed', completed_at = NOW(), updated_at = NOW()
							WHERE id = ?
							""",
					wf.id());
			completeLinkedOrders(wf);
			return Optional.of(Map.of(
					"success", true,
					"message", "Pidge partial delivery workflow completed (RTO_DELIVERED)",
					"type", "partial_delivery_return",
					"workflowId", wf.id().toString(),
					"status", "completed"));
		}

		jdbc.update(
				"UPDATE pidge_partial_delivery_workflows SET workflow_status = 'return_in_progress', updated_at = NOW() WHERE id = ?",
				wf.id());
		return Optional.of(Map.of(
				"success", true,
				"message", "Pidge partial delivery return leg update",
				"type", "partial_delivery_return",
				"workflowId", wf.id().toString(),
				"status", "return_in_progress",
				"fulfillmentStatus", ffStatusUpper));
	}

	public Map<String, Object> handleForwardDeliveredWithReturn(
			JsonNode payload,
			String originalPidgeId,
			String referenceId,
			DeliveryTracking dt,
			Shipment shipment) {
		String returnOrderId = PidgePartialDeliverySupport.extractReturnOrderId(payload);
		String payloadJson = writeJson(payload);
		String returnInfoJson = writeJson(payload.get("return_order_info"));

		UUID mealOrderId = dt != null ? dt.getMealOrderId() : null;
		UUID pharmacyOrderId = dt != null ? dt.getPharmacyOrderId() : null;
		UUID trackingId = dt != null ? dt.getId() : null;
		UUID shipmentId = shipment != null ? shipment.getId() : null;

		jdbc.update(
				"""
						INSERT INTO pidge_partial_delivery_workflows (
						  original_pidge_order_id, return_pidge_order_id, reference_id,
						  meal_order_id, pharmacy_order_id, delivery_tracking_id, shipment_id,
						  workflow_status, return_order_info, last_webhook_payload, updated_at
						) VALUES (?, ?, ?, ?, ?, ?, ?, 'forward_delivered', ?::jsonb, ?::jsonb, NOW())
						ON CONFLICT (original_pidge_order_id) DO UPDATE SET
						  return_pidge_order_id = COALESCE(EXCLUDED.return_pidge_order_id, pidge_partial_delivery_workflows.return_pidge_order_id),
						  return_order_info = EXCLUDED.return_order_info,
						  last_webhook_payload = EXCLUDED.last_webhook_payload,
						  workflow_status = 'forward_delivered',
						  updated_at = NOW()
						""",
				originalPidgeId,
				returnOrderId,
				referenceId,
				mealOrderId,
				pharmacyOrderId,
				trackingId,
				shipmentId,
				returnInfoJson,
				payloadJson);

		if (mealOrderId != null) {
			orderStatusJdbc.updateMealOrderStatus(mealOrderId, "on_the_way");
		} else if (pharmacyOrderId != null) {
			orderStatusJdbc.updatePharmacyOrderStatus(pharmacyOrderId, "on_the_way");
		}

		log.info(
				"[PIDGE PARTIAL] forward DELIVERED with return_order_info original={} return={}",
				originalPidgeId,
				returnOrderId);

		Map<String, Object> out = new java.util.LinkedHashMap<>();
		out.put("success", true);
		out.put("message", "Partial delivery: return workflow started; await return order RTO_DELIVERED");
		out.put("type", "partial_delivery_forward");
		out.put("originalPidgeOrderId", originalPidgeId);
		if (returnOrderId != null) {
			out.put("returnPidgeOrderId", returnOrderId);
		}
		out.put("workflowStatus", "forward_delivered");
		return out;
	}

	private void completeLinkedOrders(WorkflowRow wf) {
		if (wf.mealOrderId() != null) {
			orderStatusJdbc.updateMealOrderStatus(wf.mealOrderId(), "delivered");
			orderStatusJdbc.ensureMealOrderSettlementOnDelivered(wf.mealOrderId());
		} else if (wf.pharmacyOrderId() != null) {
			orderStatusJdbc.updatePharmacyOrderDelivered(wf.pharmacyOrderId());
		}
	}

	private String writeJson(JsonNode node) {
		if (node == null || node.isNull()) {
			return "{}";
		}
		try {
			return objectMapper.writeValueAsString(node);
		} catch (Exception e) {
			return node.toString();
		}
	}

	private record WorkflowRow(UUID id, UUID mealOrderId, UUID pharmacyOrderId, String workflowStatus) {}
}
