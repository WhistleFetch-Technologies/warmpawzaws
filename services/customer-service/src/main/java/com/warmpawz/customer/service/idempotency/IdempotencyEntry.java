package com.warmpawz.customer.service.idempotency;

import lombok.Builder;
import lombok.Value;

import java.time.Instant;

@Value
@Builder
public class IdempotencyEntry {
    String scopeKey;
    String idempotencyKey;
    String compositeKey;
    String payloadHash;
    String responseBody;
    Integer statusCode;
    String state;
    Instant expiresAt;
    Instant createdAt;
    Instant updatedAt;
}
