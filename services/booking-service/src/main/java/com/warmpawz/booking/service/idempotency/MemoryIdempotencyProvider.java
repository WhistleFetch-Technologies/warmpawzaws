package com.warmpawz.booking.service.idempotency;

import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class MemoryIdempotencyProvider implements IdempotencyProvider {

    private final Map<String, IdempotencyEntry> store = new ConcurrentHashMap<>();

    @Override
    public boolean reserve(String scopeKey, String idempotencyKey, String compositeKey, String payloadHash, Instant expiresAt) {
        String key = key(scopeKey, idempotencyKey);
        cleanup(key, Instant.now());
        IdempotencyEntry reserved = IdempotencyEntry.builder()
                .scopeKey(scopeKey)
                .idempotencyKey(idempotencyKey)
                .compositeKey(compositeKey)
                .payloadHash(payloadHash)
                .state("IN_PROGRESS")
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .expiresAt(expiresAt)
                .build();
        return store.putIfAbsent(key, reserved) == null;
    }

    @Override
    public Optional<IdempotencyEntry> find(String scopeKey, String idempotencyKey) {
        String key = key(scopeKey, idempotencyKey);
        cleanup(key, Instant.now());
        return Optional.ofNullable(store.get(key));
    }

    @Override
    public void markCompleted(String scopeKey, String idempotencyKey, String responseBody, int statusCode, Instant expiresAt) {
        String key = key(scopeKey, idempotencyKey);
        store.computeIfPresent(key, (k, current) -> IdempotencyEntry.builder()
                .scopeKey(current.getScopeKey())
                .idempotencyKey(current.getIdempotencyKey())
                .compositeKey(current.getCompositeKey())
                .payloadHash(current.getPayloadHash())
                .responseBody(responseBody)
                .statusCode(statusCode)
                .state("COMPLETED")
                .createdAt(current.getCreatedAt())
                .updatedAt(Instant.now())
                .expiresAt(expiresAt)
                .build());
    }

    private void cleanup(String key, Instant now) {
        IdempotencyEntry existing = store.get(key);
        if (existing != null && existing.getExpiresAt().isBefore(now)) {
            store.remove(key);
        }
    }

    private String key(String scopeKey, String idempotencyKey) {
        return scopeKey + "::" + idempotencyKey;
    }
}
