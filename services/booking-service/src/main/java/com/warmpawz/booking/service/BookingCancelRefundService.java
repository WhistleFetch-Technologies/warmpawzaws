package com.warmpawz.booking.service;

import com.warmpawz.booking.dto.request.CancelBookingRequest;
import com.warmpawz.booking.dto.response.BookingRefundInfo;
import com.warmpawz.booking.dto.response.RefundPreviewResponse;
import com.warmpawz.booking.entity.Booking;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class BookingCancelRefundService {

    private static final String WALLET_FAILED_MESSAGE =
            "Cancellation succeeded but wallet refund failed. Please contact support with your booking ID.";
    private static final String WALLET_MISSING_CUSTOMER_MESSAGE =
            "Cancellation succeeded but wallet refund could not run (missing customer on booking). Please contact support with your booking ID.";
    private static final String NOT_ELIGIBLE_MESSAGE =
            "Cancellation is too close to booking time. No refund applicable as per policy.";
    private static final String ORIGINAL_STUB_MESSAGE =
            "Cancellation succeeded but refund to original payment method is not available yet. Please contact support with your booking ID.";

    private final CustomerPaidCaptureChecker customerPaidCaptureChecker;
    private final WalletRefundCreditor walletRefundCreditor;
    private final JdbcTemplate jdbcTemplate;

    public BookingRefundInfo processRefundAfterCancel(
            Booking booking,
            UUID customerIdFromJwt,
            CancelBookingRequest request,
            RefundPreviewResponse preview
    ) {
        if (!customerPaidCaptureChecker.hasCustomerPaidCapture(booking.getId(), booking)) {
            return null;
        }

        BigDecimal refundAmount = roundMoney(preview.getRefundAmount());
        int refundPercentage = preview.getRefundPercentage();
        String refundMethod = resolveRefundMethod(request);

        if (refundAmount.compareTo(BigDecimal.ZERO) <= 0) {
            return BookingRefundInfo.builder()
                    .amount(BigDecimal.ZERO)
                    .percentage(0)
                    .method(null)
                    .status("not_eligible")
                    .message(NOT_ELIGIBLE_MESSAGE)
                    .build();
        }

        UUID customerIdForRefund = customerIdFromJwt;

        if ("wallet".equals(refundMethod)) {
            return processWalletRefund(booking, customerIdForRefund, refundAmount, refundPercentage);
        }
        if ("original".equals(refundMethod)) {
            return processOriginalPaymentRefund(booking, customerIdForRefund, refundAmount, refundPercentage, request);
        }

        return processWalletRefund(booking, customerIdForRefund, refundAmount, refundPercentage);
    }

    private BookingRefundInfo processWalletRefund(
            Booking booking,
            UUID customerIdForRefund,
            BigDecimal refundAmount,
            int refundPercentage
    ) {
        if (customerIdForRefund == null) {
            log.error("event=wallet_refund_skipped reason=missing_customer bookingId={}", booking.getId());
            return BookingRefundInfo.builder()
                    .amount(refundAmount)
                    .percentage(refundPercentage)
                    .method("wallet")
                    .status("failed")
                    .message(WALLET_MISSING_CUSTOMER_MESSAGE)
                    .build();
        }

        try {
            walletRefundCreditor.creditForBookingRefund(
                    customerIdForRefund, booking.getId(), refundAmount, refundPercentage);
            return BookingRefundInfo.builder()
                    .amount(refundAmount)
                    .percentage(refundPercentage)
                    .method("wallet")
                    .status("completed")
                    .message(String.format("₹%.2f credited to your wallet", refundAmount))
                    .build();
        } catch (Exception ex) {
            log.error("event=wallet_refund_failed bookingId={} customerId={} error={}",
                    booking.getId(), customerIdForRefund, ex.getMessage(), ex);
            return BookingRefundInfo.builder()
                    .amount(refundAmount)
                    .percentage(refundPercentage)
                    .method("wallet")
                    .status("failed")
                    .message(WALLET_FAILED_MESSAGE)
                    .build();
        }
    }

    private BookingRefundInfo processOriginalPaymentRefund(
            Booking booking,
            UUID customerIdForRefund,
            BigDecimal refundAmount,
            int refundPercentage,
            CancelBookingRequest request
    ) {
        log.warn("event=original_payment_refund_stub bookingId={} amount={} — Razorpay refund not wired in booking-service",
                booking.getId(), refundAmount);

        try {
            UUID paymentId = findCompletedPaymentId(booking.getId());
            if (paymentId != null) {
                String reason = "Booking cancellation: "
                        + (request != null && request.getReason() != null ? request.getReason() : "Customer cancellation")
                        + " (" + refundPercentage + "% refund)";
                UUID refundId = insertPendingRefundAudit(
                        paymentId, booking.getId(), customerIdForRefund, booking.getVendorId(), refundAmount, reason);
                return BookingRefundInfo.builder()
                        .amount(refundAmount)
                        .percentage(refundPercentage)
                        .method("original")
                        .status("pending")
                        .message(String.format(
                                "Refund of ₹%.2f will be processed to original payment method in 3-7 business days",
                                refundAmount))
                        .refundId(refundId)
                        .build();
            }
        } catch (Exception ex) {
            log.warn("event=refund_audit_insert_failed bookingId={} error={}", booking.getId(), ex.getMessage());
        }

        return BookingRefundInfo.builder()
                .amount(refundAmount)
                .percentage(refundPercentage)
                .method("original")
                .status("failed")
                .message(ORIGINAL_STUB_MESSAGE)
                .build();
    }

    private UUID findCompletedPaymentId(UUID bookingId) {
        try {
            return jdbcTemplate.query(
                    """
                    SELECT id FROM payments
                    WHERE booking_id = ?
                      AND payment_status IN ('completed', 'partially_refunded')
                    ORDER BY CASE WHEN payment_status = 'completed' THEN 0 ELSE 1 END
                    LIMIT 1
                    """,
                    rs -> rs.next() ? UUID.fromString(rs.getString("id")) : null,
                    bookingId
            );
        } catch (Exception ex) {
            return null;
        }
    }

    private UUID insertPendingRefundAudit(
            UUID paymentId,
            UUID bookingId,
            UUID customerId,
            UUID vendorId,
            BigDecimal refundAmount,
            String reason
    ) {
        boolean hasRefundMethod = refundTableHasColumn("refund_method");
        if (hasRefundMethod) {
            return jdbcTemplate.queryForObject(
                    """
                    INSERT INTO refunds (
                        payment_id, booking_id, customer_id, vendor_id,
                        refund_amount, refund_reason, refund_status, refund_method, requested_at
                    ) VALUES (?, ?, ?, ?, ?, ?, 'pending', 'original', NOW())
                    RETURNING id
                    """,
                    UUID.class,
                    paymentId,
                    bookingId,
                    customerId,
                    vendorId,
                    refundAmount,
                    reason
            );
        }
        return jdbcTemplate.queryForObject(
                """
                INSERT INTO refunds (
                    payment_id, booking_id, customer_id, vendor_id,
                    refund_amount, refund_reason, refund_status, requested_at
                ) VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW())
                RETURNING id
                """,
                UUID.class,
                paymentId,
                bookingId,
                customerId,
                vendorId,
                refundAmount,
                reason
        );
    }

    private boolean refundTableHasColumn(String columnName) {
        try {
            Integer found = jdbcTemplate.queryForObject(
                    """
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'refunds' AND column_name = ?
                    LIMIT 1
                    """,
                    Integer.class,
                    columnName
            );
            return found != null;
        } catch (EmptyResultDataAccessException ex) {
            return false;
        } catch (Exception ex) {
            return false;
        }
    }

    private static String resolveRefundMethod(CancelBookingRequest request) {
        if (request == null || request.getRefundMethod() == null) {
            return "wallet";
        }
        return "original".equalsIgnoreCase(request.getRefundMethod().trim()) ? "original" : "wallet";
    }

    private static BigDecimal roundMoney(BigDecimal value) {
        if (value == null) {
            return BigDecimal.ZERO;
        }
        return value.setScale(2, RoundingMode.HALF_UP);
    }
}
