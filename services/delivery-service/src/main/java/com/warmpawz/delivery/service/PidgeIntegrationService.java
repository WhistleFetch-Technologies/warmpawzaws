package com.warmpawz.delivery.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.warmpawz.delivery.service.serviceimpl.PidgeCredentialResolver;
import com.warmpawz.delivery.service.serviceimpl.PidgeCredentialResolver.ResolvedPidgeCredentials;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.StreamUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Pidge v1.0 store-channel vendor API (mirrors {@code pidge-logistics.ts}).
 */
@Service
@RequiredArgsConstructor
public class PidgeIntegrationService {

	private static final String LOGIN_PATH = "/v1.0/store/channel/vendor/login";
	private static final String CREATE_ORDER_PATH = "/v1.0/store/channel/vendor/order";
	private static final String ORDER_BY_ID_PREFIX = "/v1.0/store/channel/vendor/order";
	private static final String VENDOR_PREFIX = "/v1.0/store/channel/vendor";

	private final PidgeCredentialResolver credentialResolver;
	private final PidgeOrderPayloadBuilder payloadBuilder;
	private final ObjectMapper objectMapper;

	private final AtomicReference<String> cachedToken = new AtomicReference<>();
	private final AtomicLong tokenExpiryEpochMs = new AtomicLong(0);

	private final RestClient restClient = RestClient.create();

	public void clearTokenCache() {
		cachedToken.set(null);
		tokenExpiryEpochMs.set(0);
	}

	public String fetchVendorToken(String username, String password, String baseUrl) {
		String root = baseUrl.replaceAll("/$", "");
		String url = root + LOGIN_PATH;
		ObjectNode body = objectMapper.createObjectNode();
		body.put("username", username);
		body.put("password", password);
		String raw;
		try {
			raw = restClient.post()
					.uri(url)
					.contentType(MediaType.APPLICATION_JSON)
					.body(toJson(body))
					.retrieve()
					.onStatus(HttpStatusCode::isError, (req, res) -> {
						String text = StreamUtils.copyToString(res.getBody(), StandardCharsets.UTF_8);
						throw new IllegalStateException(
								"Pidge vendor login failed (" + res.getStatusCode().value() + "): "
										+ truncate(text, 300));
					})
					.body(String.class);
		} catch (IllegalStateException e) {
			throw e;
		} catch (Exception e) {
			throw new IllegalStateException("Pidge vendor login request failed: " + e.getMessage(), e);
		}
		JsonNode data = parseJsonRequired(raw);
		if (data.has("data") && data.get("data").isObject()) {
			JsonNode inner = data.get("data");
			if (inner.hasNonNull("token")) {
				return inner.get("token").asText();
			}
		}
		if (data.hasNonNull("token")) {
			return data.get("token").asText();
		}
		if (data.hasNonNull("access_token")) {
			return data.get("access_token").asText();
		}
		throw new IllegalStateException("Pidge login succeeded but no token in response");
	}

	public String getPidgeToken() {
		String t = cachedToken.get();
		if (t != null && System.currentTimeMillis() < tokenExpiryEpochMs.get()) {
			return t;
		}
		ResolvedPidgeCredentials c = credentialResolver.resolveRequired();
		t = fetchVendorToken(c.username(), c.password(), c.baseUrl());
		cachedToken.set(t);
		tokenExpiryEpochMs.set(System.currentTimeMillis() + 23L * 60 * 60 * 1000);
		return t;
	}

	public String getResolvedBaseUrl() {
		return credentialResolver.resolveRequired().baseUrl();
	}

	public JsonNode createOrder(JsonNode requestBody) {
		PidgeOrderPayloadBuilder.BrandDefaults defaults = credentialResolver.brandDefaults();
		JsonNode pidgePayload = PidgeOrderPayloadBuilder.isNativeCreateOrderBody(requestBody)
				? requestBody
				: payloadBuilder.buildFromSimplified(requestBody, defaults);
		String base = credentialResolver.resolveRequired().baseUrl();
		return exchangeWithRetry("POST", base + CREATE_ORDER_PATH, pidgePayload);
	}

	public JsonNode getOrderStatus(String pidgeOrderId) {
		String id = pidgeOrderId == null ? "" : pidgeOrderId.trim();
		if (id.isEmpty()) {
			throw new IllegalArgumentException("Pidge order id is required");
		}
		String base = credentialResolver.resolveRequired().baseUrl();
		String url = base + ORDER_BY_ID_PREFIX + "/" + encodePathSegment(id);
		return exchangeWithRetry("GET", url, null);
	}

	public JsonNode cancelOrder(String pidgeOrderId, JsonNode optionalBody) {
		String id = pidgeOrderId == null ? "" : pidgeOrderId.trim();
		if (id.isEmpty()) {
			throw new IllegalArgumentException("Pidge order id is required");
		}
		String base = credentialResolver.resolveRequired().baseUrl();
		String url = base + VENDOR_PREFIX + "/" + encodePathSegment(id) + "/cancel";
		if (optionalBody != null && optionalBody.isObject() && optionalBody.size() > 0) {
			return exchangeWithRetry("POST", url, optionalBody);
		}
		return exchangeWithRetry("POST", url, objectMapper.createObjectNode());
	}

	// --- Rest of Postman "Pidge Integration APIs" collection (store channel vendor) ---

	public JsonNode fulfillOrder(JsonNode body) {
		return exchangeWithRetry("POST", vendorUrl("/order/fulfill"), requireObject(body));
	}

	public JsonNode smartFulfill(JsonNode body) {
		return exchangeWithRetry("POST", vendorUrl("/order/fulfill/smart"), requireObject(body));
	}

	public JsonNode getRiderFulfillmentTracking(String pidgeOrderId) {
		String id = requireId(pidgeOrderId);
		return exchangeWithRetry("GET", vendorUrl("/order/" + encodePathSegment(id) + "/fulfillment/tracking"), null);
	}

	/** Unallocate / cancel fulfillment — PUT {@code /v1.0/store/channel/vendor/{id}/fulfillment/cancel}. */
	public JsonNode unallocateFulfillment(String pidgeOrderId) {
		String id = requireId(pidgeOrderId);
		return exchangeWithRetry("PUT", vendorUrl("/" + encodePathSegment(id) + "/fulfillment/cancel"), emptyBody());
	}

	public JsonNode getQuote(JsonNode body) {
		return exchangeWithRetry("POST", vendorUrl("/quote"), requireObject(body));
	}

	public JsonNode updateOrder(String pidgeOrderId, JsonNode body) {
		String id = requireId(pidgeOrderId);
		return exchangeWithRetry("PUT", vendorUrl("/order/" + encodePathSegment(id)), requireObject(body));
	}

	public JsonNode getEstimate(JsonNode body) {
		return exchangeWithRetry("POST", vendorUrl("/estimate"), requireObject(body));
	}

	public JsonNode listRiders() {
		return exchangeWithRetry("GET", vendorUrl("/rider/list"), null);
	}

	/**
	 * Hybrid serviceability. Postman lists GET with a JSON body; most clients use POST with this payload.
	 * If your tenant expects GET, use {@link #hybridServiceabilityGetOverQuery(JsonNode)} or {@link #vendorProxy}.
	 */
	public JsonNode hybridServiceability(JsonNode body) {
		return exchangeWithRetry("POST", vendorUrl("/serviceability"), requireObject(body));
	}

	/**
	 * Hybrid serviceability as GET with flattened query params (when upstream requires GET).
	 */
	public JsonNode hybridServiceabilityGetOverQuery(JsonNode body) {
		JsonNode b = requireObject(body);
		UriComponentsBuilder ub = UriComponentsBuilder.fromHttpUrl(vendorUrl("/serviceability"));
		if (b.has("pickup") && b.get("pickup").isObject()) {
			JsonNode p = b.get("pickup");
			if (p.has("lat")) {
				ub.queryParam("pickup_lat", p.get("lat").asText());
			}
			if (p.has("lng")) {
				ub.queryParam("pickup_lng", p.get("lng").asText());
			}
		}
		if (b.has("drop") && b.get("drop").isObject()) {
			JsonNode d = b.get("drop");
			if (d.has("lat")) {
				ub.queryParam("drop_lat", d.get("lat").asText());
			}
			if (d.has("lng")) {
				ub.queryParam("drop_lng", d.get("lng").asText());
			}
		}
		if (b.has("distance")) {
			ub.queryParam("distance", b.get("distance").asText());
		}
		if (b.has("brand") && b.get("brand").isObject()) {
			JsonNode br = b.get("brand");
			if (br.has("code")) {
				ub.queryParam("brand_code", br.get("code").asText());
			}
			if (br.has("name")) {
				ub.queryParam("brand_name", br.get("name").asText());
			}
		}
		return exchangeWithRetry("GET", ub.encode().toUri().toASCIIString(), null);
	}

	public JsonNode getOrderFulfillmentServices(List<String> ids) {
		if (ids == null || ids.isEmpty()) {
			throw new IllegalArgumentException("ids query parameter is required");
		}
		UriComponentsBuilder ub = UriComponentsBuilder.fromHttpUrl(vendorUrl("/order/fulfillment/services"));
		for (String id : ids) {
			if (id != null && !id.isBlank()) {
				ub.queryParam("ids", id.trim());
			}
		}
		return exchangeWithRetry("GET", ub.encode().toUri().toASCIIString(), null);
	}

	public JsonNode createTicket(JsonNode body) {
		return exchangeWithRetry("POST", vendorUrl("/ticket"), requireObject(body));
	}

	public JsonNode updateTicket(String ticketId, JsonNode body) {
		String id = requireId(ticketId);
		return exchangeWithRetry("PUT", vendorUrl("/ticket/update/" + encodePathSegment(id)), requireObject(body));
	}

	public JsonNode listTickets(String rawQueryStringWithoutQuestionMark) {
		String url = vendorUrl("/ticket");
		if (rawQueryStringWithoutQuestionMark != null && !rawQueryStringWithoutQuestionMark.isBlank()) {
			url += "?" + rawQueryStringWithoutQuestionMark.trim();
		}
		return exchangeWithRetry("GET", url, null);
	}

	public JsonNode sandboxDummyGetOrder(String pidgeOrderId, String dummyStatus) {
		String id = requireId(pidgeOrderId);
		UriComponentsBuilder ub = UriComponentsBuilder.fromHttpUrl(vendorUrl("/order/" + encodePathSegment(id)));
		if (dummyStatus != null && !dummyStatus.isBlank()) {
			ub.queryParam("dummy_status", dummyStatus);
		}
		return exchangeWithRetry("GET", ub.encode().toUri().toASCIIString(), null);
	}

	public JsonNode sandboxDummyWebhook(String pidgeOrderId, JsonNode body) {
		String id = requireId(pidgeOrderId);
		return exchangeWithRetry("POST", vendorUrl("/order/" + encodePathSegment(id) + "/webhook/events"),
				body != null && body.isObject() ? body : objectMapper.createObjectNode());
	}

	/**
	 * Escape hatch for APIs not mapped here (e.g. Partial Delivery — Postman has no fixed path). Path must start
	 * with {@code /v1.0/} and must not contain {@code ..}.
	 */
	public JsonNode vendorProxy(String httpMethod, String pathFromApiRoot, JsonNode body) {
		if (pathFromApiRoot == null || pathFromApiRoot.isBlank()) {
			throw new IllegalArgumentException("path is required");
		}
		String p = pathFromApiRoot.trim();
		if (!p.startsWith("/")) {
			p = "/" + p;
		}
		if (p.contains("..")) {
			throw new IllegalArgumentException("invalid path");
		}
		if (!p.startsWith("/v1.0/")) {
			throw new IllegalArgumentException("path must start with /v1.0/");
		}
		String base = credentialResolver.resolveRequired().baseUrl().replaceAll("/$", "");
		String url = base + p;
		if ("GET".equalsIgnoreCase(httpMethod) || "DELETE".equalsIgnoreCase(httpMethod)) {
			return exchangeWithRetry(httpMethod.toUpperCase(), url, null);
		}
		JsonNode payload = (body != null && body.isObject()) ? body : emptyBody();
		return exchangeWithRetry(httpMethod.toUpperCase(), url, payload);
	}

	private String vendorUrl(String suffixAfterVendorPrefix) {
		String base = credentialResolver.resolveRequired().baseUrl().replaceAll("/$", "");
		String s = suffixAfterVendorPrefix.startsWith("/") ? suffixAfterVendorPrefix : "/" + suffixAfterVendorPrefix;
		return base + VENDOR_PREFIX + s;
	}

	private static String requireId(String id) {
		if (id == null || id.isBlank()) {
			throw new IllegalArgumentException("id is required");
		}
		return id.trim();
	}

	private JsonNode requireObject(JsonNode body) {
		if (body == null || !body.isObject()) {
			throw new IllegalArgumentException("JSON object body is required");
		}
		return body;
	}

	private ObjectNode emptyBody() {
		return objectMapper.createObjectNode();
	}

	private JsonNode exchangeWithRetry(String method, String fullUrl, JsonNode body) {
		try {
			return doExchange(method, fullUrl, body);
		} catch (PidgeUnauthorizedException e) {
			clearTokenCache();
			return doExchange(method, fullUrl, body);
		}
	}

	private JsonNode doExchange(String method, String fullUrl, JsonNode body) {
		String token = getPidgeToken();
		HttpMethod httpMethod = HttpMethod.valueOf(method.toUpperCase());
		if (HttpMethod.GET.equals(httpMethod)) {
			String raw = restClient.get()
					.uri(fullUrl)
					.header("Authorization", "Bearer " + token)
					.header("Content-Type", MediaType.APPLICATION_JSON_VALUE)
					.retrieve()
					.onStatus(HttpStatusCode::isError, (req, res) -> {
						String text = StreamUtils.copyToString(res.getBody(), StandardCharsets.UTF_8);
						if (res.getStatusCode().value() == 401) {
							throw new PidgeUnauthorizedException();
						}
						throw new PidgeHttpException(res.getStatusCode().value(), text,
								"Pidge GET failed (" + res.getStatusCode().value() + "): "
										+ truncate(text, 500));
					})
					.body(String.class);
			return parseJsonLenient(raw);
		}

		if (HttpMethod.DELETE.equals(httpMethod)) {
			String raw = restClient.delete()
					.uri(fullUrl)
					.header("Authorization", "Bearer " + token)
					.retrieve()
					.onStatus(HttpStatusCode::isError, (req, res) -> {
						String text = StreamUtils.copyToString(res.getBody(), StandardCharsets.UTF_8);
						if (res.getStatusCode().value() == 401) {
							throw new PidgeUnauthorizedException();
						}
						throw new PidgeHttpException(res.getStatusCode().value(), text,
								"Pidge DELETE failed (" + res.getStatusCode().value() + "): "
										+ truncate(text, 500));
					})
					.body(String.class);
			return parseJsonLenient(raw);
		}

		String payload = body == null ? "{}" : toJson(body);
		String raw = restClient.method(httpMethod)
				.uri(fullUrl)
				.header("Authorization", "Bearer " + token)
				.contentType(MediaType.APPLICATION_JSON)
				.body(payload)
				.retrieve()
				.onStatus(HttpStatusCode::isError, (req, res) -> {
					String text = StreamUtils.copyToString(res.getBody(), StandardCharsets.UTF_8);
					if (res.getStatusCode().value() == 401) {
						throw new PidgeUnauthorizedException();
					}
					throw new PidgeHttpException(res.getStatusCode().value(), text,
							"Pidge " + method + " failed (" + res.getStatusCode().value() + "): "
									+ truncate(text, 500));
				})
				.body(String.class);
		return parseJsonLenient(raw);
	}

	private JsonNode parseJsonLenient(String raw) {
		if (raw == null || raw.isBlank()) {
			return objectMapper.createObjectNode();
		}
		try {
			return objectMapper.readTree(raw);
		} catch (Exception e) {
			throw new IllegalStateException("Pidge returned non-JSON: " + truncate(raw, 300));
		}
	}

	private JsonNode parseJsonRequired(String raw) {
		try {
			return objectMapper.readTree(raw != null ? raw : "{}");
		} catch (Exception e) {
			throw new IllegalStateException("Pidge login returned non-JSON: " + e.getMessage());
		}
	}

	private String toJson(JsonNode node) {
		try {
			return objectMapper.writeValueAsString(node);
		} catch (Exception e) {
			throw new IllegalStateException(e);
		}
	}

	private static String truncate(String s, int max) {
		if (s == null) {
			return "";
		}
		return s.length() <= max ? s : s.substring(0, max);
	}

	private static String encodePathSegment(String id) {
		return URLEncoder.encode(id, StandardCharsets.UTF_8).replace("+", "%20");
	}

	@Getter
	public static class PidgeHttpException extends RuntimeException {
		private final int httpStatus;
		private final String responseBody;

		public PidgeHttpException(int httpStatus, String responseBody, String message) {
			super(message);
			this.httpStatus = httpStatus;
			this.responseBody = responseBody;
		}
	}

	private static class PidgeUnauthorizedException extends RuntimeException {}
}
