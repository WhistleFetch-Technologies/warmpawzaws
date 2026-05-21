package com.warmpawz.booking.dto.response;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class CancelBookingResult {

    private BookingResponse booking;
    private BookingRefundInfo refund;
}
