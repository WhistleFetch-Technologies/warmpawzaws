package com.warmpawz.booking.entity;



import jakarta.persistence.*;

import lombok.Data;

import lombok.NoArgsConstructor;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;

import java.time.Instant;

import java.time.LocalDate;

import java.time.LocalTime;

import java.util.UUID;



@Entity

@Table(name = "bookings",

        indexes = {

                @Index(name = "idx_bookings_customer_id", columnList = "customer_id"),

                @Index(name = "idx_bookings_vendor_id", columnList = "vendor_id"),

                @Index(name = "idx_bookings_status", columnList = "status"),

                @Index(name = "idx_bookings_booking_date", columnList = "booking_date"),

                @Index(name = "idx_bookings_created_at", columnList = "created_at"),

                @Index(name = "idx_bookings_payment_status", columnList = "payment_status"),

                @Index(name = "idx_bookings_staff_id", columnList = "staff_id")

        })

@Data

@NoArgsConstructor

public class Booking {



    @Id

    @GeneratedValue(strategy = GenerationType.UUID)

    private UUID id;



    @Column(name = "customer_id", nullable = false)

    private UUID customerId;



    @Column(name = "customer_phone")

    private String customerPhone;



    @Column(name = "vendor_id", nullable = false)

    private UUID vendorId;



    @Column(name = "staff_id")

    private UUID staffId;



    @Column(name = "service_id")

    private UUID serviceId;



    @Column(name = "pet_id")

    private UUID petId;



    @Column(name = "booking_date", nullable = false)

    private LocalDate bookingDate;



    @JdbcTypeCode(SqlTypes.TIME)
    @Column(name = "booking_time", nullable = false)
    private LocalTime bookingTime;



    @Column(nullable = false)

    private String status = "pending";



    @Column(name = "service_type", nullable = false)

    private String serviceType;



    @Column(name = "service_style")

    private String serviceStyle;



    @Column(name = "address")

    private String address;



    @Column(name = "address_line1")

    private String addressLine1;



    @Column(name = "address_line2")

    private String addressLine2;



    @Column(name = "city")

    private String city;



    @Column(name = "state")

    private String state;



    @Column(name = "pincode")

    private String pincode;



    @Column(name = "latitude")

    private BigDecimal latitude;



    @Column(name = "longitude")

    private BigDecimal longitude;



    @Column(name = "base_price", nullable = false)

    private BigDecimal basePrice;



    @Column(name = "discount_amount", nullable = false)

    private BigDecimal discountAmount;



    @Column(name = "tax_amount", nullable = false)

    private BigDecimal taxAmount;



    @Column(name = "total_amount", nullable = false)

    private BigDecimal totalAmount;



    @Column(name = "payment_status")

    private String paymentStatus = "pending";



    @Column(name = "payment_id")

    private UUID paymentId;



    @Column(name = "otp_code")

    private String otpCode;



    @Column(name = "otp_expires_at")

    private Instant otpExpiresAt;



    @Column(name = "otp_verified")

    private Boolean otpVerified = false;



    @Column(name = "otp_verified_at")

    private Instant otpVerifiedAt;



    @Column(name = "notes")

    private String notes;



    @Column(name = "cancellation_reason")

    private String cancellationReason;



    @Column(name = "reschedule_reason")

    private String rescheduleReason;



    @Column(name = "rescheduled_from_booking_id")

    private UUID rescheduledFromBookingId;



    @Column(name = "package_purchase_id")

    private UUID packagePurchaseId;



    @Column(name = "is_package_session")

    private Boolean isPackageSession = false;



    @Column(name = "duration_minutes")

    private Integer durationMinutes;



    @Column(name = "total_duration_minutes")

    private Integer totalDurationMinutes;



    @Column(name = "flow_variant")

    private String flowVariant;



    @Column(name = "vendor_timezone")

    private String vendorTimezone;



    @Column(name = "subscription_id")

    private UUID subscriptionId;



    @Column(name = "room_id")

    private UUID roomId;



    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "selected_services", columnDefinition = "jsonb")
    private String selectedServices;



    @Column(name = "estimated_arrival")

    private Instant estimatedArrival;



    @Column(name = "check_out_date")

    private LocalDate checkOutDate;



    @JdbcTypeCode(SqlTypes.TIME)
    @Column(name = "check_out_time")
    private LocalTime checkOutTime;



    @Column(name = "completed_at")

    private Instant completedAt;



    @Column(name = "cancelled_at")

    private Instant cancelledAt;



    @Column(name = "settled_at")

    private Instant settledAt;



    @Column(name = "created_at", updatable = false)

    private Instant createdAt;



    @Column(name = "updated_at")

    private Instant updatedAt;



    @PrePersist

    void prePersist() {

        Instant now = Instant.now();

        this.createdAt = now;

        this.updatedAt = now;

    }



    @PreUpdate

    void preUpdate() {

        this.updatedAt = Instant.now();

    }

}


