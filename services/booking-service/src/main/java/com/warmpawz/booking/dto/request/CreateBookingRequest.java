package com.warmpawz.booking.dto.request;

import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Data
@NoArgsConstructor
public class CreateBookingRequest {

    @NotNull
    private UUID customerId;

    private String customerPhone;

    @NotNull
    private UUID vendorId;

    private UUID serviceId;

    private UUID staffId;

    private UUID petId;

    @NotNull
    @FutureOrPresent
    private LocalDate bookingDate;

    @NotNull
    @Pattern(regexp = "^([01]\\d|2[0-3]):[0-5]\\d$", message = "bookingTime must be in HH:MM format")
    private String bookingTime;

    @NotBlank
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

    private BigDecimal amount;
    private BigDecimal totalAmount;

    private String idempotencyKey;

    private List<SelectedServiceItem> selectedServices;

    private UUID packagePurchaseId;

    private LocalDate checkOutDate;
    private String checkOutTime;

    private String flowVariant;
    private String notes;

    private Boolean useWallet = false;
    private BigDecimal walletAmount;

    private String razorpayOrderId;

    private UUID subscriptionId;

    @Data
    @NoArgsConstructor
    public static class SelectedServiceItem {
        private UUID serviceId;
        private String serviceName;
        private BigDecimal price;
        private Integer durationMinutes;
        private Integer quantity;
    }
}
