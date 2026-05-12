package com.warmpawz.customer.service.idempotency;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Optional;
import java.util.concurrent.TimeUnit;

@Component
@RequiredArgsConstructor
@ConditionalOnClass(StringRedisTemplate.class)
@ConditionalOnBean(StringRedisTemplate.class)
public class RedisIdempotencyProvider implements IdempotencyProvider {

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    @Override
    public boolean reserve(String scopeKey, String idempotencyKey, String compositeKey, String payloadHash, Instant expiresAt) {
        String key = key(scopeKey, idempotencyKey);
        IdempotencyEntry value = IdempotencyEntry.builder()
                .scopeKey(scopeKey)
                .idempotencyKey(idempotencyKey)
                .compositeKey(compositeKey)
                .payloadHash(payloadHash)
                .state("IN_PROGRESS")
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .expiresAt(expiresAt)
                .build();
        try {
            Boolean ok = redisTemplate.opsForValue().setIfAbsent(key, objectMapper.writeValueAsString(value),
                    Math.max(1, expiresAt.getEpochSecond() - Instant.now().getEpochSecond()), TimeUnit.SECONDS);
            return Boolean.TRUE.equals(ok);
        } catch (JsonProcessingException ex) {
            return false;
        }
    }

    @Override
    public Optional<IdempotencyEntry> find(String scopeKey, String idempotencyKey) {
        String raw = redisTemplate.opsForValue().get(key(scopeKey, idempotencyKey));
        if (raw == null) {
            return Optional.empty();
        }
        try {
            return Optional.of(objectMapper.readValue(raw, IdempotencyEntry.class));
        } catch (JsonProcessingException ex) {
            return Optional.empty();
        }
    }

    @Override
    public void markCompleted(String scopeKey, String idempotencyKey, String responseBody, int statusCode, Instant expiresAt) {
        String key = key(scopeKey, idempotencyKey);
        find(scopeKey, idempotencyKey).ifPresent(existing -> {
            IdempotencyEntry completed = IdempotencyEntry.builder()
                    .scopeKey(existing.getScopeKey())
                    .idempotencyKey(existing.getIdempotencyKey())
                    .compositeKey(existing.getCompositeKey())
                    .payloadHash(existing.getPayloadHash())
                    .responseBody(responseBody)
                    .statusCode(statusCode)
                    .state("COMPLETED")
                    .createdAt(existing.getCreatedAt())
                    .updatedAt(Instant.now())
                    .expiresAt(expiresAt)
                    .build();
            try {
                redisTemplate.opsForValue().set(key, objectMapper.writeValueAsString(completed),
                        Math.max(1, expiresAt.getEpochSecond() - Instant.now().getEpochSecond()), TimeUnit.SECONDS);
            } catch (JsonProcessingException ignored) {
            }
        });
    }

    private String key(String scopeKey, String idempotencyKey) {
        return "idempotency:" + scopeKey + ":" + idempotencyKey;
    }
}
