package com.warmpawz.customer.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Entity
@Table(
        name = "customer_preferences",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_customer_pref_customer",
                        columnNames = "customer_id"
                )
        }
)
@Data
public class CustomerPreference {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "customer_id", nullable = false)
    private UUID customerId;

    // =========================
    // CORE FIELDS
    // =========================

    @Column(name = "journey_type")
    private String journeyType;

    @Column(name = "home_type")
    private String homeType;

    @Column(name = "outdoor_space")
    private String outdoorSpace;

    @Column(name = "work_schedule")
    private String workSchedule;

    @Column(name = "activity_level")
    private String activityLevel;

    @Column(name = "travel_frequency")
    private String travelFrequency;

    @Column(name = "monthly_budget")
    private String monthlyBudget;

    // =========================
    // JSON / ARRAY FIELDS
    // =========================

    @Column(name = "service_preferences", columnDefinition = "jsonb")
    private List<String> servicePreferences;

    @Column(name = "has_children")
    private Boolean hasChildren;

    @Column(name = "has_other_pets")
    private Boolean hasOtherPets;

    @Column(name = "other_pet_types", columnDefinition = "text[]")
    private List<String> otherPetTypes;

    // =========================
    // META
    // =========================

    @Column(name = "onboarding_completed_at")
    private Instant onboardingCompletedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    // =========================
    // AUDIT
    // =========================

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