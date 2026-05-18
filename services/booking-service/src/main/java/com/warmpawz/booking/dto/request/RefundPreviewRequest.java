package com.warmpawz.booking.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@NoArgsConstructor
public class RefundPreviewRequest {

    @NotNull
    private UUID bookingId;
}
