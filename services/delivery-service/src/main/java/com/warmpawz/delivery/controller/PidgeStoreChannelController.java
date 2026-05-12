package com.warmpawz.delivery.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.warmpawz.delivery.service.PidgeIntegrationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Surfaces from Postman <strong>Pidge Integration APIs</strong>
 * (<a href="https://documenter.getpostman.com/view/13758726/2s93RKzFtk">public doc</a>) aligned to
 * {@code /v1.0/store/channel/vendor/*}. Webhook payloads (Postman items 4 and 21) are <em>inbound</em> to your URL;
 * use {@code /webhooks/pidge} (and optionally a separate ticket webhook) for receiving those.
 */
@RestController
@RequiredArgsConstructor
@Tag(name = "Pidge store channel")
public class PidgeStoreChannelController {

	private final PidgeIntegrationService pidge;
	private final ObjectMapper objectMapper;

	private Map<String, Object> okPidge(JsonNode json) {
		Map<String, Object> out = new LinkedHashMap<>();
		out.put("success", true);
		out.put("pidge", objectMapper.convertValue(json, Map.class));
		return out;
	}

	@Operation(summary = "Fulfill order", description = "POST /v1.0/store/channel/vendor/order/fulfill")
	@PostMapping("/logistics/pidge/order/fulfill")
	public ResponseEntity<Map<String, Object>> fulfill(@RequestBody JsonNode body) {
		return ResponseEntity.ok(okPidge(pidge.fulfillOrder(body)));
	}

	@Operation(summary = "Smart fulfill", description = "POST /v1.0/store/channel/vendor/order/fulfill/smart")
	@PostMapping("/logistics/pidge/order/fulfill/smart")
	public ResponseEntity<Map<String, Object>> smartFulfill(@RequestBody JsonNode body) {
		return ResponseEntity.ok(okPidge(pidge.smartFulfill(body)));
	}

	@Operation(summary = "Rider tracking", description = "GET /v1.0/store/channel/vendor/order/{id}/fulfillment/tracking")
	@GetMapping("/logistics/pidge/order/{id}/fulfillment/tracking")
	public ResponseEntity<Map<String, Object>> riderTracking(@PathVariable String id) {
		return ResponseEntity.ok(okPidge(pidge.getRiderFulfillmentTracking(id)));
	}

	@Operation(summary = "Unallocate fulfillment", description = "PUT /v1.0/store/channel/vendor/{id}/fulfillment/cancel")
	@PutMapping("/logistics/pidge/vendor/{id}/fulfillment/cancel")
	public ResponseEntity<Map<String, Object>> unallocate(@PathVariable String id) {
		return ResponseEntity.ok(okPidge(pidge.unallocateFulfillment(id)));
	}

	@Operation(summary = "Get quote", description = "POST /v1.0/store/channel/vendor/quote")
	@PostMapping("/logistics/pidge/quote")
	public ResponseEntity<Map<String, Object>> quote(@RequestBody JsonNode body) {
		return ResponseEntity.ok(okPidge(pidge.getQuote(body)));
	}

	@Operation(summary = "Update order", description = "PUT /v1.0/store/channel/vendor/order/{id}")
	@PutMapping("/logistics/pidge/order/{id}")
	public ResponseEntity<Map<String, Object>> updateOrder(@PathVariable String id, @RequestBody JsonNode body) {
		return ResponseEntity.ok(okPidge(pidge.updateOrder(id, body)));
	}

	@Operation(summary = "Get estimate", description = "POST /v1.0/store/channel/vendor/estimate")
	@PostMapping("/logistics/pidge/estimate")
	public ResponseEntity<Map<String, Object>> estimate(@RequestBody JsonNode body) {
		return ResponseEntity.ok(okPidge(pidge.getEstimate(body)));
	}

	@Operation(summary = "List riders", description = "GET /v1.0/store/channel/vendor/rider/list")
	@GetMapping("/logistics/pidge/rider/list")
	public ResponseEntity<Map<String, Object>> riders() {
		return ResponseEntity.ok(okPidge(pidge.listRiders()));
	}

	@Operation(summary = "Hybrid serviceability (POST body to Pidge)",
			description = "Uses POST to upstream. Postman documents GET with a body; if your tenant only accepts GET, use /serviceability/hybrid-query.")
	@PostMapping("/logistics/pidge/serviceability/hybrid")
	public ResponseEntity<Map<String, Object>> hybridPost(@RequestBody JsonNode body) {
		return ResponseEntity.ok(okPidge(pidge.hybridServiceability(body)));
	}

	@Operation(summary = "Hybrid serviceability (builds a GET with query params)",
			description = "Use when upstream requires GET; query names are best-effort from the Postman sample.")
	@PostMapping("/logistics/pidge/serviceability/hybrid-query")
	public ResponseEntity<Map<String, Object>> hybridAsGet(@RequestBody JsonNode body) {
		return ResponseEntity.ok(okPidge(pidge.hybridServiceabilityGetOverQuery(body)));
	}

	@Operation(summary = "Get fulfillment services",
			description = "GET /v1.0/store/channel/vendor/order/fulfillment/services?ids=…")
	@GetMapping("/logistics/pidge/order/fulfillment/services")
	public ResponseEntity<Map<String, Object>> fulfillmentServices(@RequestParam List<String> ids) {
		return ResponseEntity.ok(okPidge(pidge.getOrderFulfillmentServices(ids)));
	}

	@Operation(summary = "Create ticket / issue", description = "POST /v1.0/store/channel/vendor/ticket")
	@PostMapping("/logistics/pidge/ticket")
	public ResponseEntity<Map<String, Object>> createTicket(@RequestBody JsonNode body) {
		return ResponseEntity.ok(okPidge(pidge.createTicket(body)));
	}

	@Operation(summary = "Customer update ticket",
			description = "PUT /v1.0/store/channel/vendor/ticket/update/{ticketId}")
	@PutMapping("/logistics/pidge/ticket/{ticketId}")
	public ResponseEntity<Map<String, Object>> updateTicket(@PathVariable String ticketId, @RequestBody JsonNode body) {
		return ResponseEntity.ok(okPidge(pidge.updateTicket(ticketId, body)));
	}

	@Operation(summary = "List tickets", description = "GET /v1.0/store/channel/vendor/ticket (forwards request query string)")
	@GetMapping("/logistics/pidge/tickets")
	public ResponseEntity<Map<String, Object>> listTickets(HttpServletRequest request) {
		String q = request.getQueryString();
		return ResponseEntity.ok(okPidge(pidge.listTickets(q)));
	}

	@Operation(summary = "[STG] Dummy order", description = "GET …/vendor/order/{id}?dummy_status=")
	@GetMapping("/logistics/pidge/sandbox/order/{id}")
	public ResponseEntity<Map<String, Object>> sandboxGet(
			@PathVariable String id,
			@RequestParam(required = false) String dummy_status) {
		return ResponseEntity.ok(okPidge(pidge.sandboxDummyGetOrder(id, dummy_status)));
	}

	@Operation(summary = "[STG] Dummy webhook", description = "POST …/vendor/order/{id}/webhook/events")
	@PostMapping("/logistics/pidge/sandbox/order/{id}/webhook/events")
	public ResponseEntity<Map<String, Object>> sandboxWebhook(@PathVariable String id, @RequestBody(required = false) JsonNode body) {
		return ResponseEntity.ok(okPidge(pidge.sandboxDummyWebhook(id, body)));
	}

	public record VendorProxyBody(String method, String path, JsonNode body) {}

	@Operation(summary = "Vendor proxy",
			description = "Call any /v1.0/… path for APIs without a dedicated route (e.g. Partial Delivery — no URL in Postman).")
	@PostMapping("/logistics/pidge/vendor-proxy")
	public ResponseEntity<Map<String, Object>> vendorProxy(@RequestBody VendorProxyBody req) {
		if (req.method() == null || req.path() == null) {
			return ResponseEntity.badRequest().body(Map.of("success", false, "error", "method and path are required"));
		}
		return ResponseEntity.ok(okPidge(pidge.vendorProxy(req.method(), req.path(), req.body())));
	}
}
