package com.warmpawz.booking.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.UUID;

@Data
@NoArgsConstructor
public class CreateFollowUpRequest {

    @NotNull
    private UUID originalBookingId;

    private String customerPhone;

    @NotNull
    private UUID vendorId;

    @NotNull
    private LocalDate selectedDate;

    @NotNull
    private String selectedTime;

    private UUID staffId;

    private UUID petId;

    private String notes;
}
