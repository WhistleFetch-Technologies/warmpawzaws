package com.warmpawz.booking.service;

import com.warmpawz.booking.config.OtpProperties;
import com.warmpawz.booking.dto.request.CancelBookingRequest;
import com.warmpawz.booking.dto.response.BookingRefundInfo;
import com.warmpawz.booking.dto.response.CancelBookingResult;
import com.warmpawz.booking.dto.response.RefundPreviewResponse;
import com.warmpawz.booking.entity.Booking;
import com.warmpawz.booking.enums.BookingPaymentStatus;
import com.warmpawz.booking.enums.BookingStatus;
import com.warmpawz.booking.repository.BookingRepository;
import com.warmpawz.booking.repository.BookingServiceLineRepository;
import com.warmpawz.booking.repository.BookingStatusHistoryRepository;
import com.warmpawz.booking.service.serviceimpl.BookingServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BookingServiceImplCancelRefundTest {

    @Mock
    private BookingRepository bookingRepository;
    @Mock
    private BookingStatusHistoryRepository statusHistoryRepository;
    @Mock
    private BookingServiceLineRepository serviceLineRepository;
    @Mock
    private BookingEventPublisher bookingEventPublisher;
    @Mock
    private RefundCalculationService refundCalculationService;
    @Mock
    private BookingCancelRefundService bookingCancelRefundService;

    private BookingServiceImpl bookingService;

    private UUID bookingId;
    private UUID customerId;
    private Booking booking;

    @BeforeEach
    void setUp() {
        OtpProperties otpProperties = new OtpProperties();
        bookingService = new BookingServiceImpl(
                bookingRepository,
                statusHistoryRepository,
                serviceLineRepository,
                bookingEventPublisher,
                refundCalculationService,
                bookingCancelRefundService,
                new BookingOtpProtection(otpProperties)
        );

        bookingId = UUID.randomUUID();
        customerId = UUID.randomUUID();
        booking = new Booking();
        booking.setId(bookingId);
        booking.setCustomerId(customerId);
        booking.setVendorId(UUID.randomUUID());
        booking.setStatus(BookingStatus.CONFIRMED);
        booking.setPaymentStatus(BookingPaymentStatus.PAID);
        booking.setServiceType("at_home");
        booking.setBookingDate(LocalDate.now().plusDays(2));
        booking.setBookingTime(LocalTime.of(10, 0));
        booking.setTotalAmount(BigDecimal.valueOf(500));
        booking.setBasePrice(BigDecimal.valueOf(500));
        booking.setDiscountAmount(BigDecimal.ZERO);
        booking.setTaxAmount(BigDecimal.ZERO);
    }

    @Test
    void cancelBookingCreditsWalletWhenPaid() {
        RefundPreviewResponse preview = refundPreview(BigDecimal.valueOf(500), 100);
        BookingRefundInfo refundInfo = BookingRefundInfo.builder()
                .amount(BigDecimal.valueOf(500))
                .percentage(100)
                .method("wallet")
                .status("completed")
                .message("₹500.00 credited to your wallet")
                .build();

        when(bookingRepository.findByIdAndCustomerId(bookingId, customerId)).thenReturn(Optional.of(booking));
        when(refundCalculationService.calculateRefund(booking, "customer")).thenReturn(preview);
        when(bookingRepository.save(any(Booking.class))).thenAnswer(inv -> inv.getArgument(0));
        when(bookingCancelRefundService.processRefundAfterCancel(any(), eq(customerId), any(), eq(preview)))
                .thenReturn(refundInfo);

        CancelBookingRequest request = new CancelBookingRequest();
        request.setRefundMethod("wallet");
        CancelBookingResult result = bookingService.cancelBooking(bookingId, customerId, request);

        assertEquals(BookingStatus.CANCELLED, result.getBooking().getStatus());
        assertNotNull(result.getRefund());
        assertEquals("completed", result.getRefund().getStatus());
        assertEquals("wallet", result.getRefund().getMethod());
        verify(bookingCancelRefundService).processRefundAfterCancel(any(), eq(customerId), any(), eq(preview));
    }

    @Test
    void cancelBookingStillCancelledWhenWalletRefundFails() {
        RefundPreviewResponse preview = refundPreview(BigDecimal.valueOf(500), 100);
        BookingRefundInfo refundInfo = BookingRefundInfo.builder()
                .amount(BigDecimal.valueOf(500))
                .percentage(100)
                .method("wallet")
                .status("failed")
                .message("Cancellation succeeded but wallet refund failed. Please contact support with your booking ID.")
                .build();

        when(bookingRepository.findByIdAndCustomerId(bookingId, customerId)).thenReturn(Optional.of(booking));
        when(refundCalculationService.calculateRefund(booking, "customer")).thenReturn(preview);
        when(bookingRepository.save(any(Booking.class))).thenAnswer(inv -> inv.getArgument(0));
        when(bookingCancelRefundService.processRefundAfterCancel(any(), eq(customerId), any(), eq(preview)))
                .thenReturn(refundInfo);

        CancelBookingResult result = bookingService.cancelBooking(bookingId, customerId, new CancelBookingRequest());

        assertEquals(BookingStatus.CANCELLED, result.getBooking().getStatus());
        assertEquals("failed", result.getRefund().getStatus());
    }

    @Test
    void cancelBookingSkipsRefundProcessingWhenUnpaid() {
        booking.setPaymentStatus(BookingPaymentStatus.PENDING);
        RefundPreviewResponse preview = refundPreview(BigDecimal.ZERO, 0);

        when(bookingRepository.findByIdAndCustomerId(bookingId, customerId)).thenReturn(Optional.of(booking));
        when(refundCalculationService.calculateRefund(booking, "customer")).thenReturn(preview);
        when(bookingRepository.save(any(Booking.class))).thenAnswer(inv -> inv.getArgument(0));
        when(bookingCancelRefundService.processRefundAfterCancel(any(), eq(customerId), any(), eq(preview)))
                .thenReturn(null);

        CancelBookingResult result = bookingService.cancelBooking(bookingId, customerId, new CancelBookingRequest());

        assertEquals(BookingStatus.CANCELLED, result.getBooking().getStatus());
        verify(bookingCancelRefundService).processRefundAfterCancel(any(), eq(customerId), any(), eq(preview));
    }

    private static RefundPreviewResponse refundPreview(BigDecimal amount, int percentage) {
        return new RefundPreviewResponse(
                UUID.randomUUID(),
                BookingStatus.CONFIRMED,
                BigDecimal.valueOf(500),
                amount,
                BigDecimal.ZERO,
                percentage,
                "wallet",
                "full",
                "Full refund",
                48L
        );
    }
}
