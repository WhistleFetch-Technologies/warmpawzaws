package com.warmpawz.booking.dto.response;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class AvailableSlotResponse {

    private String time;
    private boolean available;
    private String reason;
}
