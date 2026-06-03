package com.warmpawz.delivery.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.warmpawz.delivery.config.MealDeliveryNotifyProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.UUID;

/**
 * Phase 2 — After first Pidge meal cancel (APPLIED), opens Lambda refund review case (paid orders only).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MealRefundCaseBridgeService {

	private final MealDeliveryNotifyProperties properties;
	private final ObjectMapper objectMapper;
	private final RestTemplate restTemplate = new RestTemplate();

	public void dispatchRefundCaseOnPidgeCancel(
			UUID mealOrderId,
			String pidgeOrderId,
			String cancellationReason,
			UUID webhookEventId) {
		if (mealOrderId == null) {
			return;
		}
		String base = properties.getApiBaseUrl() != null ? properties.getApiBaseUrl().trim() : "";
		String secret = properties.getSecret() != null ? properties.getSecret().trim() : "";
		if (base.isEmpty() || secret.isEmpty()) {
			log.warn(
					"[meal-refund-case-bridge] skipped — notify secret not configured mealOrderId={} pidgeOrderId={}",
					mealOrderId,
					pidgeOrderId);
			return;
		}

		ObjectNode body = objectMapper.createObjectNode();
		body.put("mealOrderId", mealOrderId.toString());
		if (pidgeOrderId != null && !pidgeOrderId.isBlank()) {
			body.put("pidgeOrderId", pidgeOrderId);
		}
		if (cancellationReason != null && !cancellationReason.isBlank()) {
			body.put("cancellationReason", cancellationReason);
		}
		if (webhookEventId != null) {
			body.put("webhookEventId", webhookEventId.toString());
		}

		String url = base.replaceAll("/$", "") + "/internal/meal-refund-cases/on-pidge-cancel";
		HttpHeaders headers = new HttpHeaders();
		headers.setContentType(MediaType.APPLICATION_JSON);
		headers.set("X-Meal-Delivery-Notify-Secret", secret);
		try {
			ResponseEntity<String> resp = restTemplate.postForEntity(
					url, new HttpEntity<>(body.toString(), headers), String.class);
			log.info(
					"[meal-refund-case-bridge] Lambda mealOrderId={} pidgeOrderId={} httpStatus={}",
					mealOrderId,
					pidgeOrderId,
					resp.getStatusCode().value());
		} catch (RestClientException e) {
			log.warn(
					"[meal-refund-case-bridge] Lambda call failed mealOrderId={} pidgeOrderId={} url={} error={}",
					mealOrderId,
					pidgeOrderId,
					url,
					e.getMessage());
		}
	}
}
