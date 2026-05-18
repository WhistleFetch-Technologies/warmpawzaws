package com.warmpawz.booking.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
public class VendorCancelBookingRequest {

    @NotBlank
    private String vendorCancellationReason;

    private String notes;
}
