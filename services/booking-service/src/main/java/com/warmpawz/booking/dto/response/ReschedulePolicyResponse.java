package com.warmpawz.booking.dto.response;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.UUID;

@Data
@AllArgsConstructor
public class ReschedulePolicyResponse {

    private UUID bookingId;
    private String currentStatus;
    private boolean canReschedule;
    private String reason;
    private long hoursUntilBooking;
    private int minNoticeHours;
}
