package com.warmpawz.booking.service.serviceimpl;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.warmpawz.booking.config.IdempotencyProperties;
import com.warmpawz.booking.exception.ConflictException;
import com.warmpawz.booking.service.IdempotencyService;
import com.warmpawz.booking.service.idempotency.IdempotencyEntry;
import com.warmpawz.booking.service.idempotency.IdempotencyProvider;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Optional;
import java.util.function.Supplier;

@Service
@Slf4j
public class IdempotencyServiceImpl implements IdempotencyService {

    private final IdempotencyProvider provider;
    private final ObjectMapper objectMapper;
    private final IdempotencyProperties properties;

    public IdempotencyServiceImpl(
            @Qualifier("idempotencyProvider") IdempotencyProvider provider,
            ObjectMapper objectMapper,
            IdempotencyProperties properties
    ) {
        this.provider = provider;
        this.objectMapper = objectMapper;
        this.properties = properties;
    }

    @Override
    public <T> Optional<T> getCachedResponse(String route, String idempotencyKey, Object payload, Class<T> type) {
        if (!hasIdempotencyKey(idempotencyKey)) {
            return Optional.empty();
        }
        String scopeKey = normalizeRoute(route);
        String payloadHash = payloadHash(payload);
        IdempotencyEntry entry = provider.find(scopeKey, idempotencyKey.trim()).orElse(null);
        if (entry == null) {
            return Optional.empty();
        }
        ensurePayloadConsistency(entry, payloadHash, route, idempotencyKey);
        if (!"COMPLETED".equalsIgnoreCase(entry.getState()) || entry.getResponseBody() == null) {
            return Optional.empty();
        }
        return deserialize(entry.getResponseBody(), type);
    }

    @Override
    public void cacheResponse(String route, String idempotencyKey, Object payload, Object response) {
        if (!hasIdempotencyKey(idempotencyKey) || response == null) {
            return;
        }
        String body = serialize(response);
        if (body == null) {
            return;
        }
        Instant expiresAt = Instant.now().plusSeconds(properties.getTtlSeconds());
        provider.markCompleted(normalizeRoute(route), idempotencyKey.trim(), body, 200, expiresAt);
    }

    @Override
    public <T> T execute(String route, String idempotencyKey, Object payload, Supplier<T> action, Class<T> type) {
        if (!hasIdempotencyKey(idempotencyKey)) {
            return action.get();
        }
        String normalizedKey = idempotencyKey.trim();
        String scopeKey = normalizeRoute(route);
        String payloadHash = payloadHash(payload);
        String compositeKey = scopeKey + "::" + normalizedKey + "::" + payloadHash;
        Instant expiresAt = Instant.now().plusSeconds(properties.getTtlSeconds());

        boolean reserved = provider.reserve(scopeKey, normalizedKey, compositeKey, payloadHash, expiresAt);
        if (!reserved) {
            IdempotencyEntry existing = waitForExisting(scopeKey, normalizedKey);
            if (existing == null) {
                throw new ConflictException("Duplicate request is still processing. Retry shortly.");
            }
            ensurePayloadConsistency(existing, payloadHash, route, normalizedKey);
            if ("COMPLETED".equalsIgnoreCase(existing.getState()) && existing.getResponseBody() != null) {
                return deserialize(existing.getResponseBody(), type)
                        .orElseThrow(() -> new ConflictException("Unable to replay idempotent response"));
            }
            throw new ConflictException("Duplicate request is still processing. Retry shortly.");
        }

        T result = action.get();
        String responseBody = serialize(result);
        if (responseBody != null) {
            provider.markCompleted(scopeKey, normalizedKey, responseBody, 200, expiresAt);
        }
        return result;
    }

    private String payloadHash(Object payload) {
        String raw = "";
        try {
            raw = objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException ignored) {
            if (payload != null) raw = payload.toString();
        }
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(raw.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            return Integer.toHexString(raw.hashCode());
        }
    }

    private <T> Optional<T> deserialize(String raw, Class<T> type) {
        try {
            return Optional.of(objectMapper.readValue(raw, type));
        } catch (JsonProcessingException ex) {
            return Optional.empty();
        }
    }

    private String serialize(Object response) {
        try {
            return objectMapper.writeValueAsString(response);
        } catch (JsonProcessingException ex) {
            return null;
        }
    }

    private String normalizeRoute(String route) {
        return route == null ? "unknown" : route.trim().toLowerCase();
    }

    private boolean hasIdempotencyKey(String idempotencyKey) {
        return idempotencyKey != null && !idempotencyKey.isBlank();
    }

    private void ensurePayloadConsistency(IdempotencyEntry entry, String payloadHash, String route, String idempotencyKey) {
        if (entry.getPayloadHash() != null && !entry.getPayloadHash().equals(payloadHash)) {
            throw new ConflictException("Idempotency-Key reuse with different payload is not allowed");
        }
        log.info("event=idempotent_replay route={} key={}", route, idempotencyKey);
    }

    private IdempotencyEntry waitForExisting(String scopeKey, String idempotencyKey) {
        long timeoutAt = System.currentTimeMillis() + properties.getInProgressWaitMillis();
        while (System.currentTimeMillis() < timeoutAt) {
            IdempotencyEntry entry = provider.find(scopeKey, idempotencyKey).orElse(null);
            if (entry == null || "COMPLETED".equalsIgnoreCase(entry.getState())) {
                return entry;
            }
            try {
                Thread.sleep(Math.max(10, properties.getInProgressPollMillis()));
            } catch (InterruptedException ex) {
                Thread.currentThread().interrupt();
                return entry;
            }
        }
        return provider.find(scopeKey, idempotencyKey).orElse(null);
    }
}
