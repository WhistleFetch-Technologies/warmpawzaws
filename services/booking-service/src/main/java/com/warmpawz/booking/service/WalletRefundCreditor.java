package com.warmpawz.booking.service;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Credits customer wallet for a booking cancellation refund (idempotent per booking).
 */
public interface WalletRefundCreditor {

    void creditForBookingRefund(UUID customerId, UUID bookingId, BigDecimal refundAmount, int refundPercentage);
}
