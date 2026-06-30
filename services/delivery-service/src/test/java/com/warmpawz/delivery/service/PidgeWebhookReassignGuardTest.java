package com.warmpawz.delivery.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.warmpawz.delivery.entity.DeliveryTracking;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PidgeWebhookReassignGuardTest {

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

	@InjectMocks
	private MealRiderReassignService service;

	private final ObjectMapper realMapper = new ObjectMapper();

	private UUID mealOrderId;
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
		tracking = new DeliveryTracking();
		tracking.setId(UUID.randomUUID());
		tracking.setMealOrderId(mealOrderId);
		tracking.setMetadataJson("{\"reassign_pending\":true}");
	}

	@Test
	void isReassignActive_whenMetadataPending() {
		assertTrue(service.isReassignActiveForTracking(tracking));
	}

	@Test
	void isReassignActive_whenRecentCompletedRequest() {
		tracking.setMetadataJson("{}");
		when(jdbc.queryForObject(
						eq("SELECT COUNT(*)::int FROM meal_rider_reassign_requests WHERE meal_order_id = ? AND status = 'pending'"),
						eq(Integer.class),
						eq(mealOrderId)))
				.thenReturn(0);
		when(jdbc.queryForObject(any(String.class), eq(Integer.class), eq(mealOrderId), eq("3")))
				.thenReturn(1);
		assertTrue(service.isReassignActiveForTracking(tracking));
	}

	@Test
	void isReassignInactive_whenNoFlagsOrRecentActivity() {
		tracking.setMetadataJson("{}");
		when(jdbc.queryForObject(any(String.class), eq(Integer.class), eq(mealOrderId))).thenReturn(0);
		when(jdbc.queryForObject(any(String.class), eq(Integer.class), eq(mealOrderId), eq("3")))
				.thenReturn(0);
		assertFalse(service.isReassignActiveForTracking(tracking));
	}
}
