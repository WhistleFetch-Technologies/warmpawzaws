package com.warmpawz.customer.entity;
import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;
@Entity
@Table(name = "customer_addresses",
        indexes = {
                @Index(name = "idx_customer_addresses_customer", columnList = "customer_id")
        })
@Data
public class CustomerAddress {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id", nullable = false)
    private Customer customer;

    @Column(name = "address_type")
    private String addressType = "home";

    @Column(name = "full_name", nullable = false)
    private String fullName;

    @Column(nullable = false)
    private String phone;

    @Column(name = "address_line1", nullable = false)
    private String addressLine1;

    @Column(name = "address_line2")
    private String addressLine2;

    @Column(nullable = false)
    private String city;

    @Column(nullable = false)
    private String state;

    @Column(nullable = false)
    private String pincode;

    private String landmark;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, Object> coordinates;
    @Column(name = "is_default")
    private boolean isDefault;

    @Column(name = "flat_no")
    private String flatNo;

    @Column(name = "house_no")
    private String houseNo;

    private String floor;

    @Column(name = "street_name")
    private String streetName;

    @Column(name = "apartment_name")
    private String apartmentName;

    private Instant createdAt;
    private Instant updatedAt;
}