package com.warmpawz.customer.entity;

import com.warmpawz.customer.enums.OnboardingStatus;
import jakarta.persistence.*;
import lombok.Data;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;
@Data
@Entity
@Table(name = "customer_identity",
        indexes = {
                @Index(name = "idx_identity_phone", columnList = "phone")
        })
public class CustomerIdentity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true)
    private String phone;

    private String email;

    @Enumerated(EnumType.STRING)
    private OnboardingStatus onboardingStatus = OnboardingStatus.INIT;

    private String currentStep;

    @Column(columnDefinition = "jsonb")
    private Map<String, Object> metadata;

    private Instant lastActivityAt;
    private Instant createdAt;
    private Instant updatedAt;

    @OneToOne(mappedBy = "customerIdentity")
    private Customer customer;

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
        updatedAt = Instant.now();
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }
}