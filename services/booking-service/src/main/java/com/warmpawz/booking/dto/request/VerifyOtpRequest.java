package com.warmpawz.booking.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@NoArgsConstructor
public class VerifyOtpRequest {

    @NotNull
    private UUID bookingId;

    @NotBlank
    private String otp;

    private UUID vendorId;
}
