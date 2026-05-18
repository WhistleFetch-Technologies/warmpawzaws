package com.warmpawz.booking.repository;

import com.warmpawz.booking.entity.IdempotencyRecord;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface IdempotencyRecordRepository extends JpaRepository<IdempotencyRecord, UUID> {
    Optional<IdempotencyRecord> findByScopeKeyAndIdempotencyKey(String scopeKey, String idempotencyKey);

    void deleteByExpiresAtBefore(Instant now);
}
