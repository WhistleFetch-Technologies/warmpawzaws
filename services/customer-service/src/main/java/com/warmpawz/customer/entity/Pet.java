package com.warmpawz.customer.entity;


import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.JdbcTypeCode;

import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;
@Entity
@Table(name = "pets",
        indexes = {
                @Index(name = "idx_pet_customer", columnList = "customer_id")
        })
@Data
public class Pet {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id", nullable = false)
    private Customer customer;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String species;

    private String breed;

    @Column(name = "age_years")
    private Integer ageYears;

    @Column(name = "age_months")
    private Integer ageMonths;

    private String gender;

    @Column(name = "weight_kg")
    private Double weightKg;

    @Column(name = "profile_photo_url")
    private String profilePhotoUrl;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "medical_history", columnDefinition = "jsonb")
    private Map<String, Object> medicalHistory;
    private Instant createdAt;
    private Instant updatedAt;
}