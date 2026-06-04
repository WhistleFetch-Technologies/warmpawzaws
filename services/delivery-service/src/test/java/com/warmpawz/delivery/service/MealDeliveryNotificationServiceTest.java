package com.warmpawz.delivery.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.warmpawz.delivery.config.MealDeliveryNotifyProperties;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.lang.reflect.Method;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Customer logistics-cancel maps to {@code meal_logistics_cancelled} (not vendor-only failed).
 */
@ExtendWith(MockitoExtension.class)
class MealDeliveryNotificationServiceTest {

	@Mock
	private JdbcTemplate jdbc;

	@InjectMocks
	private MealDeliveryNotificationService service;

	@Test
	void mapCustomerRiderEventType_cancelled_returnsLogisticsCancelled() throws Exception {
		// @InjectMocks does not supply final ObjectMapper — construct explicitly for reflection test
		service = new MealDeliveryNotificationService(new MealDeliveryNotifyProperties(), jdbc, new ObjectMapper());
		Method m = MealDeliveryNotificationService.class.getDeclaredMethod(
				"mapCustomerRiderEventType", String.class, String.class);
		m.setAccessible(true);
		Object event = m.invoke(service, "cancelled", "failed");
		assertEquals("meal_logistics_cancelled", event);
	}
}
