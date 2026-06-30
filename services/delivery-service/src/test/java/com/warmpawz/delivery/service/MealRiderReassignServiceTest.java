package com.warmpawz.delivery.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.warmpawz.delivery.entity.DeliveryTracking;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MealRiderReassignServiceTest {

	@Mock
	private JdbcTemplate jdbc;
	@Mock
	private ObjectMapper objectMapper;
	@Mock
	private com.warmpawz.delivery.repository.DeliveryTrackingRepository deliveryTrackingRepository;
	@Mock
	private PidgeIntegrationService pidgeIntegrationService;
	@Mock
	private MealDeliveryNotificationService mealDeliveryNotificationService;
	@Mock
	private MealRiderReassignPersistence mealRiderReassignPersistence;

	private MealRiderReassignService service;

	private final ObjectMapper realMapper = new ObjectMapper();
	private UUID mealOrderId;
	private UUID trackingId;
	private DeliveryTracking tracking;

	@BeforeEach
	void setUp() {
		service = new MealRiderReassignService(
				jdbc,
				realMapper,
				deliveryTrackingRepository,
				pidgeIntegrationService,
				mealDeliveryNotificationService,
				mealRiderReassignPersistence);
		mealOrderId = UUID.randomUUID();
		trackingId = UUID.randomUUID();
		tracking = new DeliveryTracking();
		tracking.setId(trackingId);
		tracking.setMealOrderId(mealOrderId);
	}

	@Test
	void reassignRider_commitsPrepareBeforePidgeUnallocate() throws Exception {
		ObjectNode body = realMapper.createObjectNode();
		body.put("mealOrderId", mealOrderId.toString());

		Map<String, Object> dtRow = new HashMap<>();
		dtRow.put("id", trackingId);
		dtRow.put("status", "heading_to_pickup");
		dtRow.put("external_task_id", "PIDGE-1");
		dtRow.put("delivery_person_name", "Rider A");
		dtRow.put("delivery_person_phone", "999");
		dtRow.put("picked_up_at", null);
		dtRow.put("metadata", "{}");
		dtRow.put("logistics_partner", "pidge");

		Map<String, Object> eligibilityDt = new HashMap<>();
		eligibilityDt.put("status", "heading_to_pickup");
		eligibilityDt.put("picked_up_at", null);
		eligibilityDt.put("external_task_id", "PIDGE-1");

		Map<String, Object> moRow = Map.of(
				"id", mealOrderId,
				"status", "ready_for_pickup",
				"payment_status", "paid",
				"logistics_type", "pidge",
				"pidge_order_id", "PIDGE-1",
				"cancelled_by", "");

		when(jdbc.queryForList(any(String.class), eq(mealOrderId))).thenAnswer(invocation -> {
			String sql = invocation.getArgument(0, String.class);
			if (sql.contains("FROM meal_orders")) {
				return List.of(moRow);
			}
			if (sql.contains("meal_rider_reassign_requests")) {
				return List.of();
			}
			if (sql.contains("SELECT status, picked_up_at, external_task_id")) {
				return List.of(eligibilityDt);
			}
			if (sql.contains("FROM delivery_tracking")) {
				return List.of(dtRow);
			}
			return List.of();
		});

		MealRiderReassignPrepared prepared = new MealRiderReassignPrepared(
				mealOrderId, UUID.randomUUID(), trackingId, "PIDGE-1", Optional.of(tracking));
		when(mealRiderReassignPersistence.prepareReassignPending(
						eq(mealOrderId),
						eq(trackingId),
						eq("PIDGE-1"),
						eq(null),
						eq(null),
						eq("Rider A"),
						eq("999")))
				.thenReturn(prepared);

		Map<String, Object> out = service.reassignRider(body);

		InOrder order = inOrder(mealRiderReassignPersistence, pidgeIntegrationService);
		order.verify(mealRiderReassignPersistence).prepareReassignPending(
				eq(mealOrderId),
				eq(trackingId),
				eq("PIDGE-1"),
				eq(null),
				eq(null),
				eq("Rider A"),
				eq("999"));
		order.verify(pidgeIntegrationService).unallocateFulfillment("PIDGE-1");

		assertTrue(Boolean.TRUE.equals(out.get("success")));
		assertEquals("reassign_pending", out.get("status"));
		verify(mealDeliveryNotificationService).notifyMealRiderReassignPending(tracking, "PIDGE-1");
	}
}
