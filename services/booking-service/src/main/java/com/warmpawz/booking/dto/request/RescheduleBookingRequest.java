package com.warmpawz.booking.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

import java.time.LocalDate;

@Data
public class RescheduleBookingRequest {

    @NotNull
    private LocalDate newDate;

    @NotNull
    @Pattern(regexp = "^([01]\\d|2[0-3]):[0-5]\\d$", message = "newTime must be in HH:MM format")
    private String newTime;

    private String reason;
}
