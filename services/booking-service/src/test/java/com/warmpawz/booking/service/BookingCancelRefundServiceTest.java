package com.warmpawz.booking.service;

import com.warmpawz.booking.dto.request.CancelBookingRequest;
import com.warmpawz.booking.dto.response.BookingRefundInfo;
import com.warmpawz.booking.dto.response.RefundPreviewResponse;
import com.warmpawz.booking.entity.Booking;
import com.warmpawz.booking.enums.BookingPaymentStatus;
import com.warmpawz.booking.enums.BookingStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BookingCancelRefundServiceTest {

    @Mock
    private CustomerPaidCaptureChecker customerPaidCaptureChecker;
    @Mock
    private WalletRefundCreditor walletRefundCreditor;
    @Mock
    private JdbcTemplate jdbcTemplate;

    private BookingCancelRefundService refundService;

    private UUID bookingId;
    private UUID customerId;
    private Booking booking;

    @BeforeEach
    void setUp() {
        refundService = new BookingCancelRefundService(customerPaidCaptureChecker, walletRefundCreditor, jdbcTemplate);
        bookingId = UUID.randomUUID();
        customerId = UUID.randomUUID();
        booking = new Booking();
        booking.setId(bookingId);
        booking.setCustomerId(customerId);
        booking.setVendorId(UUID.randomUUID());
        booking.setStatus(BookingStatus.CONFIRMED);
        booking.setPaymentStatus(BookingPaymentStatus.PAID);
    }

    @Test
    void returnsNullWhenBookingNotPaid() {
        when(customerPaidCaptureChecker.hasCustomerPaidCapture(bookingId, booking)).thenReturn(false);

        BookingRefundInfo info = refundService.processRefundAfterCancel(
                booking, customerId, new CancelBookingRequest(), preview(BigDecimal.valueOf(100), 100));

        assertNull(info);
        verify(walletRefundCreditor, never()).creditForBookingRefund(any(), any(), any(), any(Integer.class));
    }

    @Test
    void walletRefundCompletedOnSuccess() {
        when(customerPaidCaptureChecker.hasCustomerPaidCapture(bookingId, booking)).thenReturn(true);

        CancelBookingRequest request = new CancelBookingRequest();
        request.setRefundMethod("wallet");

        BookingRefundInfo info = refundService.processRefundAfterCancel(
                booking, customerId, request, preview(BigDecimal.valueOf(250.50), 100));

        assertEquals("completed", info.getStatus());
        assertEquals("wallet", info.getMethod());
        assertEquals(0, info.getAmount().compareTo(new BigDecimal("250.50")));
        assertEquals("₹250.50 credited to your wallet", info.getMessage());
        verify(walletRefundCreditor).creditForBookingRefund(customerId, bookingId, new BigDecimal("250.50"), 100);
    }

    @Test
    void walletRefundFailedDoesNotThrow() {
        when(customerPaidCaptureChecker.hasCustomerPaidCapture(bookingId, booking)).thenReturn(true);
        doThrow(new RuntimeException("wallet down"))
                .when(walletRefundCreditor)
                .creditForBookingRefund(eq(customerId), eq(bookingId), any(), eq(50));

        BookingRefundInfo info = refundService.processRefundAfterCancel(
                booking, customerId, new CancelBookingRequest(), preview(BigDecimal.valueOf(100), 50));

        assertEquals("failed", info.getStatus());
        assertEquals("wallet", info.getMethod());
        assertEquals(
                "Cancellation succeeded but wallet refund failed. Please contact support with your booking ID.",
                info.getMessage());
    }

    @Test
    void notEligibleWhenRefundAmountZero() {
        when(customerPaidCaptureChecker.hasCustomerPaidCapture(bookingId, booking)).thenReturn(true);

        BookingRefundInfo info = refundService.processRefundAfterCancel(
                booking, customerId, new CancelBookingRequest(), preview(BigDecimal.ZERO, 0));

        assertEquals("not_eligible", info.getStatus());
        verify(walletRefundCreditor, never()).creditForBookingRefund(any(), any(), any(), any(Integer.class));
    }

    @Test
    void originalMethodStubReturnsFailedWithoutPayment() {
        when(customerPaidCaptureChecker.hasCustomerPaidCapture(bookingId, booking)).thenReturn(true);

        CancelBookingRequest request = new CancelBookingRequest();
        request.setRefundMethod("original");

        BookingRefundInfo info = refundService.processRefundAfterCancel(
                booking, customerId, request, preview(BigDecimal.valueOf(100), 100));

        assertEquals("failed", info.getStatus());
        assertEquals("original", info.getMethod());
        verify(walletRefundCreditor, never()).creditForBookingRefund(any(), any(), any(), any(Integer.class));
    }

    private static RefundPreviewResponse preview(BigDecimal amount, int percentage) {
        return new RefundPreviewResponse(
                UUID.randomUUID(),
                BookingStatus.CONFIRMED,
                BigDecimal.valueOf(100),
                amount,
                BigDecimal.ZERO,
                percentage,
                "wallet",
                "full",
                "policy",
                10L
        );
    }
}
