package com.warmpawz.delivery.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.warmpawz.delivery.config.PidgeProperties;
import com.warmpawz.delivery.service.serviceimpl.PidgeWebhookProcessingService;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Webhooks: GET/POST /webhooks/pidge — canonical Pidge ingress (register this URL in Pidge; monolith no longer handles Pidge).
 */
@RestController
@RequiredArgsConstructor
@Tag(name = "Logistics webhooks")
public class LogisticsWebhookController {

	private final PidgeProperties pidgeProperties;
	private final PidgeWebhookProcessingService pidgeWebhookProcessingService;

	@GetMapping("/webhooks/pidge")
	public ResponseEntity<Map<String, Object>> pidgeWebhookInfo() {
		String base = pidgeProperties.getPublicApiBaseUrl() == null
				? "https://YOUR_API_GATEWAY_OR_DOMAIN"
				: pidgeProperties.getPublicApiBaseUrl().replaceAll("/$", "");
		String clientUrl = base + "/webhooks/pidge";
		return ResponseEntity.ok(Map.of(
				"ok", true,
				"message",
				"Register clientUrl in Pidge (Channel integration → Webhook URL). Point PUBLIC_API_BASE_URL at this delivery-service. Local dev: ngrok/cloudflared.",
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
		Map<String, Object> result = pidgeWebhookProcessingService.handlePidgePayload(payload);
		if (result.containsKey("error")) {
			return ResponseEntity.badRequest().body(result);
		}
		return ResponseEntity.ok(result);
	}
}
