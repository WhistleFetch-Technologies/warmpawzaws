package com.warmpawz.customer.service.idempotency;

import com.warmpawz.customer.entity.IdempotencyRecord;
import com.warmpawz.customer.repository.IdempotencyRecordRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;

@Component
@RequiredArgsConstructor
public class DbIdempotencyProvider implements IdempotencyProvider {

    private final IdempotencyRecordRepository repository;

    @Override
    @Transactional
    public boolean reserve(String scopeKey, String idempotencyKey, String compositeKey, String payloadHash, Instant expiresAt) {
        repository.deleteByExpiresAtBefore(Instant.now());
        IdempotencyRecord record = new IdempotencyRecord();
        record.setScopeKey(scopeKey);
        record.setIdempotencyKey(idempotencyKey);
        record.setCompositeKey(compositeKey);
        record.setPayloadHash(payloadHash);
        record.setState("IN_PROGRESS");
        record.setCreatedAt(Instant.now());
        record.setUpdatedAt(Instant.now());
        record.setExpiresAt(expiresAt);
        try {
            repository.saveAndFlush(record);
            return true;
        } catch (DataIntegrityViolationException ignored) {
            return false;
        }
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<IdempotencyEntry> find(String scopeKey, String idempotencyKey) {
        return repository.findByScopeKeyAndIdempotencyKey(scopeKey, idempotencyKey)
                .filter(record -> record.getExpiresAt() != null && record.getExpiresAt().isAfter(Instant.now()))
                .map(record -> IdempotencyEntry.builder()
                        .scopeKey(record.getScopeKey())
                        .idempotencyKey(record.getIdempotencyKey())
                        .compositeKey(record.getCompositeKey())
                        .payloadHash(record.getPayloadHash())
                        .responseBody(record.getResponseBody())
                        .statusCode(record.getStatusCode())
                        .state(record.getState())
                        .createdAt(record.getCreatedAt())
                        .updatedAt(record.getUpdatedAt())
                        .expiresAt(record.getExpiresAt())
                        .build());
    }

    @Override
    @Transactional
    public void markCompleted(String scopeKey, String idempotencyKey, String responseBody, int statusCode, Instant expiresAt) {
        repository.findByScopeKeyAndIdempotencyKey(scopeKey, idempotencyKey).ifPresent(record -> {
            record.setResponseBody(responseBody);
            record.setStatusCode(statusCode);
            record.setState("COMPLETED");
            record.setUpdatedAt(Instant.now());
            record.setExpiresAt(expiresAt);
            repository.save(record);
        });
    }
}
