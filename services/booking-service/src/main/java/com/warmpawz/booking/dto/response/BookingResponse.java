package com.warmpawz.booking.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Data
@NoArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class BookingResponse {

    private UUID id;
    private UUID customerId;
    private String customerPhone;
    private UUID vendorId;
    private UUID staffId;
    private UUID serviceId;
    private UUID petId;
    private LocalDate bookingDate;
    private String bookingTime;
    private String status;
    private String serviceType;
    private String serviceStyle;
    private String address;
    private String addressLine1;
    private String addressLine2;
    private String city;
    private String state;
    private String pincode;
    private BigDecimal latitude;
    private BigDecimal longitude;
    private BigDecimal basePrice;
    private BigDecimal discountAmount;
    private BigDecimal taxAmount;
    private BigDecimal totalAmount;
    private String paymentStatus;
    private UUID paymentId;
    private Boolean otpVerified;
    private String notes;
    private String cancellationReason;
    private String rescheduleReason;
    private UUID rescheduledFromBookingId;
    private UUID packagePurchaseId;
    private Boolean isPackageSession;
    private Integer durationMinutes;
    private Integer totalDurationMinutes;
    private String flowVariant;
    private String vendorTimezone;
    private UUID subscriptionId;
    private String roomId;
    private String selectedServices;
    private String estimatedArrival;
    private LocalDate checkOutDate;
    private String checkOutTime;
    private String createdAt;
    private String updatedAt;
    private String completedAt;
    private String cancelledAt;
    private String settledAt;
}
