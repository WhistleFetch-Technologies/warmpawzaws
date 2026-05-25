package com.warmpawz.delivery.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.warmpawz.delivery.config.PidgeProperties;
import lombok.extern.slf4j.Slf4j;
import com.warmpawz.delivery.service.serviceimpl.PidgeTicketWebhookProcessingService;
import com.warmpawz.delivery.service.serviceimpl.PidgeWebhookProcessingService;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Webhooks: GET/POST /webhooks/pidge — canonical Pidge ingress (status updates + Rider Task from Communications Module).
 */
@Slf4j
@RestController
@RequiredArgsConstructor
@Tag(name = "Logistics webhooks")
public class LogisticsWebhookController {

	private final PidgeProperties pidgeProperties;
	private final PidgeWebhookProcessingService pidgeWebhookProcessingService;
	private final PidgeTicketWebhookProcessingService pidgeTicketWebhookProcessingService;
	private final ObjectMapper objectMapper;

	@GetMapping("/webhooks/pidge")
	public ResponseEntity<Map<String, Object>> pidgeWebhookInfo() {
		String base = pidgeProperties.getPublicApiBaseUrl() == null
				? "https://YOUR_API_GATEWAY_OR_DOMAIN"
				: pidgeProperties.getPublicApiBaseUrl().replaceAll("/$", "");
		String clientUrl = base + "/webhooks/pidge";
		return ResponseEntity.ok(Map.of(
				"ok", true,
				"message",
				"Register clientUrl in Pidge. Status updates: Channel integration → Webhook URL. "
						+ "Rider active task: Communications Module. Ticket status: set update_info.callback_url on create issue.",
				"clientUrl", clientUrl,
				"riderTaskUrl", clientUrl + "/rider-task",
				"ticketStatusUrl", clientUrl + "/ticket",
				"method", "POST",
				"payloadKinds", List.of("order_status", "rider_task", "ticket_status"),
				"note",
				"Optional: PIDGE_WEBHOOK_BEARER_TOKEN + Authorization: Bearer <token> (use {{callback_auth}} in Pidge)."));
	}

	@PostMapping(value = "/webhooks/pidge", consumes = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<?> pidgeIngest(
			@RequestHeader(value = "Authorization", required = false) String authorization,
			@RequestBody String rawBody) {
		return ingestPidgeWebhook(authorization, rawBody, WebhookKind.AUTO);
	}

	/** Explicit ingress when Pidge Communications Module is configured with a dedicated rider-task URL. */
	@PostMapping(value = "/webhooks/pidge/rider-task", consumes = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<?> pidgeRiderTaskIngest(
			@RequestHeader(value = "Authorization", required = false) String authorization,
			@RequestBody String rawBody) {
		return ingestPidgeWebhook(authorization, rawBody, WebhookKind.RIDER_TASK);
	}

	/** Ticket Management — Webhook Ticket Status Update ({@code update_info.callback_url} on create issue). */
	@PostMapping(value = "/webhooks/pidge/ticket", consumes = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<?> pidgeTicketStatusIngest(
			@RequestHeader(value = "Authorization", required = false) String authorization,
			@RequestBody String rawBody) {
		return ingestPidgeWebhook(authorization, rawBody, WebhookKind.TICKET_STATUS);
	}

	private enum WebhookKind {
		AUTO,
		RIDER_TASK,
		TICKET_STATUS
	}

	private ResponseEntity<?> ingestPidgeWebhook(String authorization, String rawBody, WebhookKind kind) {
		if (kind == WebhookKind.RIDER_TASK) {
			log.info("[PIDGE RIDER TASK RAW] {}", rawBody != null ? rawBody : "");
		}
		JsonNode payload;
		try {
			payload = objectMapper.readTree(rawBody != null && !rawBody.isBlank() ? rawBody : "{}");
		} catch (Exception e) {
			return ResponseEntity.badRequest().body(Map.of("error", "Invalid JSON"));
		}
		String secret = pidgeProperties.getWebhookBearerToken();
		if (secret != null && !secret.isBlank()) {
			String expected = "Bearer " + secret.trim();
			if (authorization == null || !expected.equals(authorization)) {
				return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Unauthorized"));
			}
		}
		Map<String, Object> result =
				switch (kind) {
					case RIDER_TASK -> pidgeWebhookProcessingService.handleRiderTaskPayload(payload);
					case TICKET_STATUS -> pidgeTicketWebhookProcessingService.handleTicketStatusPayload(payload);
					case AUTO -> pidgeWebhookProcessingService.handlePidgePayload(payload);
				};
		if (result.containsKey("error")) {
			return ResponseEntity.badRequest().body(result);
		}
		return ResponseEntity.ok(result);
	}
}
