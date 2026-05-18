package com.warmpawz.booking.service;

import com.warmpawz.booking.dto.response.RefundPreviewResponse;
import com.warmpawz.booking.entity.Booking;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;

@Service
@Slf4j
public class RefundCalculationService {

    /**
     * Policy-based refund calculation:
     * - More than 24 hours before booking: 100% refund
     * - 12–24 hours before booking: 50% refund
     * - Less than 12 hours before booking: 0% refund
     * - Booking already started (in_progress/completed): 0% refund
     * - Vendor cancelled: 100% refund always
     */
    public RefundPreviewResponse calculateRefund(Booking booking, String cancelledByType) {
        BigDecimal totalAmount = booking.getTotalAmount() != null
                ? booking.getTotalAmount() : BigDecimal.ZERO;

        if ("vendor".equals(cancelledByType)) {
            return new RefundPreviewResponse(
                    booking.getId(), booking.getStatus(), totalAmount,
                    totalAmount, BigDecimal.ZERO, 100, "wallet", "full",
                    "Full refund as vendor cancelled"
            );
        }

        if (totalAmount.compareTo(BigDecimal.ZERO) == 0) {
            return new RefundPreviewResponse(
                    booking.getId(), booking.getStatus(), BigDecimal.ZERO,
                    BigDecimal.ZERO, BigDecimal.ZERO, 100, "wallet", "full",
                    "No payment made"
            );
        }

        try {
            String[] parts = booking.getBookingTime().split(":");
            int hours = Integer.parseInt(parts[0]);
            int minutes = Integer.parseInt(parts[1]);
            LocalDateTime bookingDateTime = booking.getBookingDate()
                    .atTime(hours, minutes);
            LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
            long hoursUntilBooking = ChronoUnit.HOURS.between(now, bookingDateTime);

            if (hoursUntilBooking > 24) {
                return new RefundPreviewResponse(booking.getId(), booking.getStatus(),
                        totalAmount, totalAmount, BigDecimal.ZERO, 100, "wallet",
                        "full", "Full refund — cancelled more than 24 hours before");
            } else if (hoursUntilBooking >= 12) {
                BigDecimal refund = totalAmount.multiply(new BigDecimal("0.50"))
                        .setScale(2, RoundingMode.HALF_UP);
                BigDecimal deduction = totalAmount.subtract(refund);
                return new RefundPreviewResponse(booking.getId(), booking.getStatus(),
                        totalAmount, refund, deduction, 50, "wallet",
                        "partial_50", "50% refund — cancelled 12–24 hours before");
            } else {
                return new RefundPreviewResponse(booking.getId(), booking.getStatus(),
                        totalAmount, BigDecimal.ZERO, totalAmount, 0, "wallet",
                        "no_refund", "No refund — cancelled less than 12 hours before");
            }
        } catch (Exception ex) {
            log.warn("event=refund_calc_failed bookingId={} error={}",
                    booking.getId(), ex.getMessage());
            return new RefundPreviewResponse(booking.getId(), booking.getStatus(),
                    totalAmount, totalAmount, BigDecimal.ZERO, 100, "wallet",
                    "full", "Full refund (policy calculation error — defaulting to full)");
        }
    }
}
