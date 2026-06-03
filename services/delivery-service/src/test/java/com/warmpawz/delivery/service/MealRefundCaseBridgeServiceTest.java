package com.warmpawz.delivery.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.warmpawz.delivery.config.MealDeliveryNotifyProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;

import java.lang.reflect.Field;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MealRefundCaseBridgeServiceTest {

	@Mock
	private RestTemplate restTemplate;

	private MealRefundCaseBridgeService service;

	@BeforeEach
	void setUp() throws Exception {
		MealDeliveryNotifyProperties props = new MealDeliveryNotifyProperties();
		props.setApiBaseUrl("https://api.example.com");
		props.setSecret("test-secret");
		service = new MealRefundCaseBridgeService(props, new ObjectMapper());
		Field rt = MealRefundCaseBridgeService.class.getDeclaredField("restTemplate");
		rt.setAccessible(true);
		rt.set(service, restTemplate);
	}

	@Test
	void dispatchRefundCaseOnPidgeCancel_postsInternalEndpoint() {
		when(restTemplate.postForEntity(any(String.class), any(HttpEntity.class), eq(String.class)))
				.thenReturn(new ResponseEntity<>("{\"success\":true}", HttpStatus.OK));

		UUID mealOrderId = UUID.fromString("11111111-1111-4111-8111-111111111111");
		UUID webhookId = UUID.fromString("22222222-2222-4222-8222-222222222222");
		service.dispatchRefundCaseOnPidgeCancel(mealOrderId, "pidge-99", "cancelled by partner", webhookId);

		ArgumentCaptor<String> urlCaptor = ArgumentCaptor.forClass(String.class);
		verify(restTemplate).postForEntity(urlCaptor.capture(), any(HttpEntity.class), eq(String.class));
		assertTrue(urlCaptor.getValue().endsWith("/internal/meal-refund-cases/on-pidge-cancel"));
	}
}
