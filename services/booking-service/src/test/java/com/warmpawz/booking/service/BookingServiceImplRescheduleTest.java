package com.warmpawz.booking.service;

import com.warmpawz.booking.config.OtpProperties;
import com.warmpawz.booking.dto.request.RescheduleBookingRequest;
import com.warmpawz.booking.dto.response.BookingResponse;
import com.warmpawz.booking.entity.Booking;
import com.warmpawz.booking.entity.BookingStatusHistory;
import com.warmpawz.booking.enums.BookingPaymentStatus;
import com.warmpawz.booking.enums.BookingStatus;
import com.warmpawz.booking.repository.BookingRepository;
import com.warmpawz.booking.repository.BookingServiceLineRepository;
import com.warmpawz.booking.repository.BookingStatusHistoryRepository;
import com.warmpawz.booking.service.serviceimpl.BookingServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Collections;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BookingServiceImplRescheduleTest {

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
    private UUID paymentId;
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
        paymentId = UUID.randomUUID();
        booking = new Booking();
        booking.setId(bookingId);
        booking.setCustomerId(customerId);
        booking.setVendorId(UUID.randomUUID());
        booking.setServiceId(UUID.randomUUID());
        booking.setStatus(BookingStatus.CONFIRMED);
        booking.setPaymentStatus(BookingPaymentStatus.PAID);
        booking.setPaymentId(paymentId);
        booking.setServiceType("at_home");
        booking.setBookingDate(LocalDate.now().plusDays(2));
        booking.setBookingTime(LocalTime.of(10, 0));
        booking.setDurationMinutes(60);
        booking.setTotalAmount(BigDecimal.valueOf(500));
        booking.setBasePrice(BigDecimal.valueOf(500));
        booking.setDiscountAmount(BigDecimal.ZERO);
        booking.setTaxAmount(BigDecimal.ZERO);
    }

    @Test
    void rescheduleBookingUpdatesSameRowAndPreservesPaymentId() {
        LocalDate newDate = LocalDate.now().plusDays(5);
        String newTime = "14:30";

        when(bookingRepository.findByIdAndCustomerId(bookingId, customerId)).thenReturn(Optional.of(booking));
        when(bookingRepository.findOverlappingBookings(any(), eq(newDate), any(), any(Integer.class), any(Integer.class)))
                .thenReturn(Collections.emptyList());
        when(bookingRepository.save(any(Booking.class))).thenAnswer(inv -> inv.getArgument(0));

        RescheduleBookingRequest request = new RescheduleBookingRequest();
        request.setNewDate(newDate);
        request.setNewTime(newTime);
        request.setReason("Need later slot");

        BookingResponse response = bookingService.rescheduleBooking(bookingId, customerId, request);

        assertEquals(bookingId, response.getId());
        assertEquals(paymentId, response.getPaymentId());
        assertEquals(BookingStatus.CONFIRMED, response.getStatus());
        assertEquals(newDate, response.getBookingDate());
        assertEquals(newTime, response.getBookingTime());
        assertNotEquals(BookingStatus.RESCHEDULED, response.getStatus());

        ArgumentCaptor<Booking> savedCaptor = ArgumentCaptor.forClass(Booking.class);
        verify(bookingRepository).save(savedCaptor.capture());
        Booking saved = savedCaptor.getValue();
        assertEquals(bookingId, saved.getId());
        assertEquals(paymentId, saved.getPaymentId());
        assertEquals(BookingStatus.CONFIRMED, saved.getStatus());
        assertEquals(newDate, saved.getBookingDate());
        assertEquals(LocalTime.of(14, 30), saved.getBookingTime());
        assertEquals(bookingId, saved.getRescheduledFromBookingId());
        assertEquals("Need later slot", saved.getRescheduleReason());

        ArgumentCaptor<BookingStatusHistory> historyCaptor = ArgumentCaptor.forClass(BookingStatusHistory.class);
        verify(statusHistoryRepository).save(historyCaptor.capture());
        BookingStatusHistory history = historyCaptor.getValue();
        assertEquals(bookingId, history.getBookingId());
        assertEquals(BookingStatus.CONFIRMED, history.getFromStatus());
        assertEquals(BookingStatus.CONFIRMED, history.getToStatus());

        verify(bookingEventPublisher).publishBookingStatusUpdatedAfterCommit(
                eq(bookingId), eq(BookingStatus.CONFIRMED), eq(BookingStatus.CONFIRMED),
                eq(customerId), eq(booking.getVendorId()));
    }
}
