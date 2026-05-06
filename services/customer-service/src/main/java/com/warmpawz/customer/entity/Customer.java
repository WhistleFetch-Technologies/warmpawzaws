package com.warmpawz.customer.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.time.Instant;
import java.time.LocalDate;
import java.util.*;

@Entity
@Table(
        name = "customers",
        indexes = {
                @Index(name = "idx_customers_phone", columnList = "phone"),
                @Index(name = "idx_customers_status", columnList = "status"),
                @Index(name = "idx_customers_onboarding_status", columnList = "onboarding_status")
        }
)
@Data
public class Customer {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true)
    private String phone;

    private String email;

    @Column(name = "full_name", nullable = false)
    private String fullName;

    @Column(name = "date_of_birth")
    private LocalDate dateOfBirth;

    private String gender;

    private String address;
    private String city;
    private String state;
    private String pincode;

    @Column(name = "profile_photo_url")
    private String profilePhotoUrl;

    @Column(name = "is_active", nullable = false)
    private boolean isActive = true;

    private String status = "new";

    @Column(name = "onboarding_status")
    private String onboardingStatus = "INIT";

    @Column(name = "profile_completed")
    private boolean profileCompleted = false;

    @Column(name = "profile_completed_at")
    private Instant profileCompletedAt;

    @Column(name = "last_login_at")
    private Instant lastLoginAt;

    // ================= RELATIONS =================

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_identity_id")
    private CustomerIdentity customerIdentity;

    @OneToOne(mappedBy = "customer", cascade = CascadeType.ALL, orphanRemoval = true)
    private CustomerProfileCompletion profileCompletion;

    @OneToMany(mappedBy = "customer", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<CustomerAddress> addresses = new ArrayList<>();

    @OneToMany(mappedBy = "customer", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Pet> pets = new ArrayList<>();

    // ================= TIMESTAMPS =================

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

    // ================= CONSTANTS =================

    public static final String STATUS_NEW = "new";
    public static final String STATUS_ACTIVE = "active";
    public static final String STATUS_INACTIVE = "inactive";
    public static final String STATUS_SUSPENDED = "suspended";

    public static final String ONBOARDING_INIT = "INIT";
    public static final String ONBOARDING_COMPLETED = "COMPLETED";
}