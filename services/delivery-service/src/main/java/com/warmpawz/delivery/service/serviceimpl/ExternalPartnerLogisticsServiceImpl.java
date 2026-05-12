package com.warmpawz.delivery.service.serviceimpl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.warmpawz.delivery.service.ExternalPartnerLogisticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.RestClient;

import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;

@Service
@RequiredArgsConstructor
public class ExternalPartnerLogisticsServiceImpl implements ExternalPartnerLogisticsService {

	private static final String SHIPROCKET_BASE = "https://apiv2.shiprocket.in/v1/external";
	private static final String DELHIVERY_BASE = "https://track.delhivery.com/api";
	private static final String DUNZO_BASE = "https://apis.dunzo.in/api/v1";

	private final ObjectMapper objectMapper;
	private final RestClient restClient = RestClient.create();

	private final AtomicReference<String> shiprocketToken = new AtomicReference<>();
	private final AtomicLong shiprocketTokenExpiry = new AtomicLong();
	private final AtomicReference<String> dunzoToken = new AtomicReference<>();
	private final AtomicLong dunzoTokenExpiry = new AtomicLong();

	@Value("${shiprocket.email:}")
	private String shiprocketEmail;
	@Value("${shiprocket.password:}")
	private String shiprocketPassword;

	@Value("${delhivery.api-token:}")
	private String delhiveryApiToken;

	@Value("${dunzo.client-id:}")
	private String dunzoClientId;
	@Value("${dunzo.client-secret:}")
	private String dunzoClientSecret;

	@Override
	public ObjectMapper mapper() {
		return objectMapper;
	}

	private String getShiprocketToken() {
		try {
			String t = shiprocketToken.get();
			if (t != null && System.currentTimeMillis() < shiprocketTokenExpiry.get()) {
				return t;
			}
			if (shiprocketEmail == null || shiprocketEmail.isBlank() || shiprocketPassword == null || shiprocketPassword.isBlank()) {
				throw new IllegalStateException("Shiprocket credentials not set (SHIPROCKET_EMAIL / SHIPROCKET_PASSWORD)");
			}
			ObjectNode body = objectMapper.createObjectNode();
			body.put("email", shiprocketEmail);
			body.put("password", shiprocketPassword);
			String raw = restClient.post()
					.uri(SHIPROCKET_BASE + "/auth/login")
					.contentType(MediaType.APPLICATION_JSON)
					.body(objectMapper.writeValueAsString(body))
					.retrieve()
					.body(String.class);
			JsonNode j = objectMapper.readTree(raw);
			t = j.path("token").asText(null);
			if (t == null || t.isEmpty()) {
				throw new IllegalStateException("Shiprocket token missing in login response");
			}
			shiprocketToken.set(t);
			shiprocketTokenExpiry.set(System.currentTimeMillis() + 10L * 24 * 60 * 60 * 1000);
			return t;
		} catch (RestClientResponseException e) {
			throw new IllegalStateException("Shiprocket login failed: " + e.getStatusCode() + " " + bodyPreview(e), e);
		} catch (Exception e) {
			throw new IllegalStateException("Shiprocket login failed: " + e.getMessage(), e);
		}
	}

	private String getDunzoToken() {
		try {
			String t = dunzoToken.get();
			if (t != null && System.currentTimeMillis() < dunzoTokenExpiry.get()) {
				return t;
			}
			if (dunzoClientId == null || dunzoClientId.isBlank() || dunzoClientSecret == null || dunzoClientSecret.isBlank()) {
				throw new IllegalStateException("Dunzo credentials not set (DUNZO_CLIENT_ID / DUNZO_CLIENT_SECRET)");
			}
			ObjectNode body = objectMapper.createObjectNode();
			body.put("client_id", dunzoClientId);
			body.put("client_secret", dunzoClientSecret);
			String raw = restClient.post()
					.uri(DUNZO_BASE + "/token")
					.contentType(MediaType.APPLICATION_JSON)
					.body(objectMapper.writeValueAsString(body))
					.retrieve()
					.body(String.class);
			JsonNode j = objectMapper.readTree(raw);
			t = j.hasNonNull("token") ? j.get("token").asText() : j.path("access_token").asText(null);
			if (t == null || t.isEmpty()) {
				throw new IllegalStateException("Dunzo token missing");
			}
			dunzoToken.set(t);
			dunzoTokenExpiry.set(System.currentTimeMillis() + 50 * 60 * 1000);
			return t;
		} catch (RestClientResponseException e) {
			throw new IllegalStateException("Dunzo token failed: " + e.getStatusCode() + " " + bodyPreview(e), e);
		} catch (Exception e) {
			throw new IllegalStateException("Dunzo token failed: " + e.getMessage(), e);
		}
	}

	@Override
	public JsonNode shiprocketCreateAdhoc(JsonNode orderData) throws Exception {
		try {
			String token = getShiprocketToken();
			String raw = restClient.post()
					.uri(SHIPROCKET_BASE + "/orders/create/adhoc")
					.header("Authorization", "Bearer " + token)
					.contentType(MediaType.APPLICATION_JSON)
					.body(objectMapper.writeValueAsString(orderData))
					.retrieve()
					.body(String.class);
			return objectMapper.readTree(raw);
		} catch (RestClientResponseException e) {
			throw new IllegalStateException(bodyPreview(e), e);
		}
	}

	@Override
	public JsonNode shiprocketTrackShipment(String shipmentId) throws Exception {
		try {
			String token = getShiprocketToken();
			String raw = restClient.get()
					.uri(SHIPROCKET_BASE + "/shipments/track/" + shipmentId)
					.header("Authorization", "Bearer " + token)
					.retrieve()
					.body(String.class);
			return objectMapper.readTree(raw);
		} catch (RestClientResponseException e) {
			throw new IllegalStateException(bodyPreview(e), e);
		}
	}

	@Override
	public JsonNode shiprocketGenerateAwb(JsonNode body) throws Exception {
		try {
			String token = getShiprocketToken();
			String raw = restClient.post()
					.uri(SHIPROCKET_BASE + "/courier/assign/awb")
					.header("Authorization", "Bearer " + token)
					.contentType(MediaType.APPLICATION_JSON)
					.body(objectMapper.writeValueAsString(body))
					.retrieve()
					.body(String.class);
			return objectMapper.readTree(raw);
		} catch (RestClientResponseException e) {
			throw new IllegalStateException(bodyPreview(e), e);
		}
	}

	@Override
	public JsonNode delhiveryCreateOrder(JsonNode body) throws Exception {
		if (delhiveryApiToken == null || delhiveryApiToken.isBlank()) {
			throw new IllegalStateException("Delhivery API token not set (DELHIVERY_API_TOKEN)");
		}
		try {
			String raw = restClient.post()
					.uri(DELHIVERY_BASE + "/cmu/create.json")
					.header("Authorization", "Token " + delhiveryApiToken)
					.contentType(MediaType.APPLICATION_JSON)
					.body(objectMapper.writeValueAsString(body))
					.retrieve()
					.body(String.class);
			return objectMapper.readTree(raw);
		} catch (RestClientResponseException e) {
			throw new IllegalStateException(bodyPreview(e), e);
		}
	}

	@Override
	public JsonNode delhiveryTrack(String waybill) throws Exception {
		if (delhiveryApiToken == null || delhiveryApiToken.isBlank()) {
			throw new IllegalStateException("Delhivery API token not set");
		}
		try {
			String enc = java.net.URLEncoder.encode(waybill, StandardCharsets.UTF_8);
			String raw = restClient.get()
					.uri(DELHIVERY_BASE + "/v1/packages/json/?waybill=" + enc)
					.header("Authorization", "Token " + delhiveryApiToken)
					.retrieve()
					.body(String.class);
			return objectMapper.readTree(raw);
		} catch (RestClientResponseException e) {
			throw new IllegalStateException(bodyPreview(e), e);
		}
	}

	@Override
	public JsonNode delhiveryCancelWaybill(String waybill) throws Exception {
		if (delhiveryApiToken == null || delhiveryApiToken.isBlank()) {
			throw new IllegalStateException("Delhivery API token not set");
		}
		try {
			ObjectNode b = objectMapper.createObjectNode();
			b.put("waybill", waybill);
			b.put("cancellation", true);
			String raw = restClient.post()
					.uri(DELHIVERY_BASE + "/p/edit")
					.header("Authorization", "Token " + delhiveryApiToken)
					.contentType(MediaType.APPLICATION_JSON)
					.body(objectMapper.writeValueAsString(b))
					.retrieve()
					.body(String.class);
			return objectMapper.readTree(raw == null || raw.isBlank() ? "{}" : raw);
		} catch (RestClientResponseException e) {
			throw new IllegalStateException(bodyPreview(e), e);
		}
	}

	@Override
	public JsonNode dunzoCreateTask(JsonNode body) throws Exception {
		try {
			String token = getDunzoToken();
			String raw = restClient.post()
					.uri(DUNZO_BASE + "/tasks")
					.header("Authorization", "Bearer " + token)
					.header("client-id", dunzoClientId != null ? dunzoClientId : "")
					.contentType(MediaType.APPLICATION_JSON)
					.body(objectMapper.writeValueAsString(body))
					.retrieve()
					.body(String.class);
			return objectMapper.readTree(raw);
		} catch (RestClientResponseException e) {
			throw new IllegalStateException(bodyPreview(e), e);
		}
	}

	@Override
	public JsonNode dunzoGetTask(String taskId) throws Exception {
		try {
			String token = getDunzoToken();
			String enc = java.net.URLEncoder.encode(taskId, StandardCharsets.UTF_8);
			String raw = restClient.get()
					.uri(DUNZO_BASE + "/tasks/" + enc)
					.header("Authorization", "Bearer " + token)
					.header("client-id", dunzoClientId != null ? dunzoClientId : "")
					.retrieve()
					.body(String.class);
			return objectMapper.readTree(raw);
		} catch (RestClientResponseException e) {
			throw new IllegalStateException(bodyPreview(e), e);
		}
	}

	@Override
	public JsonNode dunzoCancelTask(String taskId) throws Exception {
		try {
			String token = getDunzoToken();
			String enc = java.net.URLEncoder.encode(taskId, StandardCharsets.UTF_8);
			String raw = restClient.post()
					.uri(DUNZO_BASE + "/tasks/" + enc + "/_cancel")
					.header("Authorization", "Bearer " + token)
					.header("client-id", dunzoClientId != null ? dunzoClientId : "")
					.retrieve()
					.body(String.class);
			return objectMapper.readTree(raw == null || raw.isBlank() ? "{\"success\":true}" : raw);
		} catch (RestClientResponseException e) {
			throw new IllegalStateException(bodyPreview(e), e);
		}
	}

	private static String bodyPreview(RestClientResponseException e) {
		String b = e.getResponseBodyAsString(StandardCharsets.UTF_8);
		return b != null && b.length() > 500 ? b.substring(0, 500) : (b != null ? b : e.getMessage());
	}
}
