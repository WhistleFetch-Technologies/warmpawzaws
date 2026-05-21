package com.warmpawz.booking.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BookingRefundInfo {

    private BigDecimal amount;
    private int percentage;
    private String method;
    private String status;
    private String message;
    private UUID refundId;
}
