package com.warmpawz.booking.service.idempotency;

import java.time.Instant;
import java.util.Optional;

public interface IdempotencyProvider {

    boolean reserve(String scopeKey, String idempotencyKey, String compositeKey, String payloadHash, Instant expiresAt);

    Optional<IdempotencyEntry> find(String scopeKey, String idempotencyKey);

    void markCompleted(String scopeKey, String idempotencyKey, String responseBody, int statusCode, Instant expiresAt);
}
