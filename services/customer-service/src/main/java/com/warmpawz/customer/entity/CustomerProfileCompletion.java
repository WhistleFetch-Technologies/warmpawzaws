package com.warmpawz.customer.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.JdbcTypeCode;

import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "customer_profile_completion")
@Data
public class CustomerProfileCompletion {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "customer_id", nullable = false, unique = true)
    private UUID customerId;

    @OneToOne
    @JoinColumn(name = "customer_id", insertable = false, updatable = false)
    private Customer customer;

    private boolean basicInfoCompleted = false;
    private boolean addressCompleted = false;
    private boolean petProfileCompleted = false;
    private boolean preferencesCompleted = false;

    @Column(name = "is_profile_complete")
    private boolean isProfileComplete = false;

    @Column(name = "profile_completed_at")
    private Instant profileCompletedAt;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "completion_metadata", columnDefinition = "jsonb")
    private Map<String, Object> completionMetadata;
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = Instant.now();
    }
}