package com.warmpawz.delivery.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.warmpawz.delivery.config.PidgeProperties;
import com.warmpawz.delivery.service.serviceimpl.PidgeWebhookProcessingService;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.nio.charset.StandardCharsets;
import java.util.Map;

/**
 * Webhooks: GET/POST /webhooks/pidge (Lambda {@code logistics-webhooks.ts} subset).
 * Other partner webhooks can be added here; full Shiprocket/Delhivery payload handling is legacy-sized.
 */
@RestController
@RequiredArgsConstructor
@Tag(name = "Logistics webhooks")
public class LogisticsWebhookController {

	private final PidgeProperties pidgeProperties;
	private final PidgeWebhookProcessingService pidgeWebhookProcessingService;
	private final ObjectMapper objectMapper;
	private final RestClient restClient = RestClient.create();

	@GetMapping("/webhooks/pidge")
	public ResponseEntity<Map<String, Object>> pidgeWebhookInfo() {
		String base = pidgeProperties.getPublicApiBaseUrl() == null
				? "https://YOUR_API_GATEWAY_OR_DOMAIN"
				: pidgeProperties.getPublicApiBaseUrl().replaceAll("/$", "");
		String clientUrl = base + "/webhooks/pidge";
		return ResponseEntity.ok(Map.of(
				"ok", true,
				"message",
				"Register clientUrl in Pidge (Channel integration → Webhook URL). For local dev use ngrok/cloudflared.",
				"clientUrl", clientUrl,
				"method", "POST",
				"note",
				"Optional: PIDGE_WEBHOOK_BEARER_TOKEN + Authorization: Bearer <token>."));
	}

	@PostMapping(value = "/webhooks/pidge", consumes = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<?> pidgeIngest(
			@RequestHeader(value = "Authorization", required = false) String authorization,
			@RequestBody JsonNode payload) {
		String secret = pidgeProperties.getWebhookBearerToken();
		if (secret != null && !secret.isBlank()) {
			String expected = "Bearer " + secret.trim();
			if (authorization == null || !expected.equals(authorization)) {
				return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Unauthorized"));
			}
		}
		String forward = pidgeProperties.getWebhookForwardUrl();
		if (forward != null && !forward.isBlank()) {
			String raw;
			try {
				raw = objectMapper.writeValueAsString(payload);
			} catch (com.fasterxml.jackson.core.JsonProcessingException e) {
				return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
			}
			try {
				String resp = restClient.post()
						.uri(forward.trim())
						.contentType(MediaType.APPLICATION_JSON)
						.headers(h -> {
							if (authorization != null) {
								h.set("Authorization", authorization);
							}
						})
						.body(raw)
						.retrieve()
						.body(String.class);
				return ResponseEntity.ok(Map.of("forwarded", true, "forwardBody", resp != null ? resp : ""));
			} catch (RestClientResponseException e) {
				return ResponseEntity.status(e.getStatusCode()).body(Map.of(
						"error", e.getResponseBodyAsString(StandardCharsets.UTF_8)));
			}
		}
		Map<String, Object> result = pidgeWebhookProcessingService.handlePidgePayload(payload);
		if (result.containsKey("error")) {
			return ResponseEntity.badRequest().body(result);
		}
		return ResponseEntity.ok(result);
	}
}
