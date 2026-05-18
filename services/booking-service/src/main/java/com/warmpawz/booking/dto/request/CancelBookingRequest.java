package com.warmpawz.booking.dto.request;

import lombok.Data;

@Data
public class CancelBookingRequest {

    private String reason;
    private String customerId;
    private String phone;
    private String refundMethod = "wallet";
}
