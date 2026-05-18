package com.warmpawz.booking.dto.response;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data
@AllArgsConstructor
public class OtpResponse {

    private UUID bookingId;
    private String message;
    private Instant expiresAt;
}
