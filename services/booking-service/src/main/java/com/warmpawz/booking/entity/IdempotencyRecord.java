package com.warmpawz.booking.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "idempotency_records",
        uniqueConstraints = @UniqueConstraint(name = "uk_idempotency_scope_key", columnNames = {"scope_key", "idempotency_key"}),
        indexes = {
                @Index(name = "idx_idempotency_expires_at", columnList = "expires_at")
        })
@Data
public class IdempotencyRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "scope_key", nullable = false, length = 255)
    private String scopeKey;

    @Column(name = "idempotency_key", nullable = false, length = 128)
    private String idempotencyKey;

    @Column(name = "composite_key", nullable = false, length = 512)
    private String compositeKey;

    @Column(name = "payload_hash", nullable = false, length = 128)
    private String payloadHash;

    @Column(name = "status_code")
    private Integer statusCode;

    @Column(name = "response_body", columnDefinition = "text")
    private String responseBody;

    @Column(nullable = false, length = 32)
    private String state;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
