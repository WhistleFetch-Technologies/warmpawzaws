package com.warmpawz.booking.service;

import com.warmpawz.booking.entity.Booking;
import com.warmpawz.booking.enums.BookingPaymentStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Component
@RequiredArgsConstructor
@Slf4j
public class JdbcCustomerPaidCaptureChecker implements CustomerPaidCaptureChecker {

    private static final Set<String> CAPTURE_PAYMENT_STATUSES = Set.of(
            BookingPaymentStatus.PAID,
            BookingPaymentStatus.COMPLETED,
            BookingPaymentStatus.PARTIAL,
            "processing",
            "successful",
            "succeeded",
            "captured",
            "capture_done"
    );

    private final JdbcTemplate jdbcTemplate;

    @Override
    public boolean hasCustomerPaidCapture(UUID bookingId, Booking booking) {
        if (bookingId == null) {
            return false;
        }
        if (booking != null && bookingPaymentStatusImpliesCapture(booking.getPaymentStatus())) {
            return true;
        }
        if (loadWalletDebitTotalForBooking(bookingId) > 0.009) {
            return true;
        }
        try {
            Integer found = jdbcTemplate.query(
                    """
                    SELECT 1 FROM payments
                    WHERE booking_id = ?
                      AND payment_status IN ('completed', 'partially_refunded', 'processing', 'paid')
                      AND COALESCE(amount, 0) > 0.009
                    LIMIT 1
                    """,
                    rs -> rs.next() ? 1 : null,
                    bookingId
            );
            return found != null;
        } catch (Exception ex) {
            log.debug("event=payment_capture_check_failed bookingId={} error={}", bookingId, ex.getMessage());
            return false;
        }
    }

    private static boolean bookingPaymentStatusImpliesCapture(String paymentStatus) {
        if (paymentStatus == null || paymentStatus.isBlank()) {
            return false;
        }
        return CAPTURE_PAYMENT_STATUSES.contains(paymentStatus.trim().toLowerCase(Locale.ROOT));
    }

    private double loadWalletDebitTotalForBooking(UUID bookingId) {
        try {
            BigDecimal sum = jdbcTemplate.queryForObject(
                    """
                    SELECT COALESCE(SUM(amount), 0) FROM wallet_transactions
                    WHERE transaction_type = 'debit' AND booking_id = ?
                    """,
                    BigDecimal.class,
                    bookingId
            );
            return sum != null ? sum.doubleValue() : 0;
        } catch (Exception ex) {
            log.debug("event=wallet_debit_sum_failed bookingId={} error={}", bookingId, ex.getMessage());
            return 0;
        }
    }
}
