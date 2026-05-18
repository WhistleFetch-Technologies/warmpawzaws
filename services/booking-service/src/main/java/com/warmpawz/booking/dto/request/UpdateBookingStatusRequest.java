package com.warmpawz.booking.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class UpdateBookingStatusRequest {

    @NotBlank
    private String status;

    private String reason;
    private String notes;
    private String actorId;
    private String actorType;
}
