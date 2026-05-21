package com.warmpawz.booking.dto.response;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@AllArgsConstructor
public class RefundPreviewResponse {

    private UUID bookingId;
    private String currentStatus;
    private BigDecimal originalAmount;
    private BigDecimal refundAmount;
    private BigDecimal deductionAmount;
    private int refundPercentage;
    private String refundMethod;
    private String policy;
    private String reason;
    private Long hoursUntil;
}
