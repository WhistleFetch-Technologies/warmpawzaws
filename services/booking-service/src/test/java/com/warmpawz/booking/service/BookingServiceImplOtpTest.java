package com.warmpawz.booking.service;

import com.warmpawz.booking.config.OtpProperties;
import com.warmpawz.booking.dto.request.GenerateOtpRequest;
import com.warmpawz.booking.dto.request.VerifyOtpRequest;
import com.warmpawz.booking.entity.Booking;
import com.warmpawz.booking.enums.BookingStatus;
import com.warmpawz.booking.exception.BadRequestException;
import com.warmpawz.booking.exception.NotFoundException;
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

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BookingServiceImplOtpTest {

    @Mock
    private BookingRepository bookingRepository;
    @Mock
    private BookingStatusHistoryRepository statusHistoryRepository;
    @Mock
    private BookingServiceLineRepository serviceLineRepository;
    @Mock
    private BookingEventPublisher bookingEventPublisher;
    @Mock
    private com.warmpawz.booking.service.RefundCalculationService refundCalculationService;
    @Mock
    private BookingCancelRefundService bookingCancelRefundService;

    private BookingOtpProtection bookingOtpProtection;

    private BookingServiceImpl bookingService;

    private UUID bookingId;
    private UUID customerId;
    private UUID vendorId;
    private Booking booking;

    @BeforeEach
    void setUp() {
        OtpProperties otpProperties = new OtpProperties();
        otpProperties.setGenerateMaxPerBookingPerHour(2);
        otpProperties.setVerifyMaxAttempts(3);
        bookingOtpProtection = new BookingOtpProtection(otpProperties);
        bookingService = new BookingServiceImpl(
                bookingRepository,
                statusHistoryRepository,
                serviceLineRepository,
                bookingEventPublisher,
                refundCalculationService,
                bookingCancelRefundService,
                bookingOtpProtection
        );

        bookingId = UUID.randomUUID();
        customerId = UUID.randomUUID();
        vendorId = UUID.randomUUID();
        booking = new Booking();
        booking.setId(bookingId);
        booking.setCustomerId(customerId);
        booking.setVendorId(vendorId);
        booking.setStatus(BookingStatus.CONFIRMED);
        booking.setServiceType("at_home");
        booking.setServiceStyle("at_home");
    }

    @Test
    void generateOtpRejectsUnrelatedPrincipal() {
        when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));
        GenerateOtpRequest request = new GenerateOtpRequest();
        request.setBookingId(bookingId);

        assertThrows(NotFoundException.class,
                () -> bookingService.generateOtp(request, UUID.randomUUID()));
    }

    @Test
    void generateOtpAllowsCustomerAndStoresFourDigitCode() {
        when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));
        when(bookingRepository.save(any(Booking.class))).thenAnswer(inv -> inv.getArgument(0));

        GenerateOtpRequest request = new GenerateOtpRequest();
        request.setBookingId(bookingId);
        bookingService.generateOtp(request, customerId);

        ArgumentCaptor<Booking> saved = ArgumentCaptor.forClass(Booking.class);
        verify(bookingRepository).save(saved.capture());
        String otp = saved.getValue().getOtpCode();
        assertEquals(4, otp.length());
        assertTrue(Integer.parseInt(otp) >= 1000);
    }

    @Test
    void generateOtpRateLimitAfterMaxNewGenerations() {
        when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));
        when(bookingRepository.save(any(Booking.class))).thenAnswer(inv -> inv.getArgument(0));

        GenerateOtpRequest request = new GenerateOtpRequest();
        request.setBookingId(bookingId);

        bookingService.generateOtp(request, customerId);
        booking.setOtpCode(null);
        bookingService.generateOtp(request, customerId);
        booking.setOtpCode(null);

        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> bookingService.generateOtp(request, customerId));
        assertEquals("Too many OTP requests; try again later", ex.getMessage());
    }

    @Test
    void generateOtpReturnsExistingWithoutRegenerating() {
        booking.setOtpCode("5678");
        booking.setOtpExpiresAt(Instant.now().plus(1, ChronoUnit.HOURS));
        when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));

        GenerateOtpRequest request = new GenerateOtpRequest();
        request.setBookingId(bookingId);
        var response = bookingService.generateOtp(request, customerId);

        assertEquals("Existing OTP retrieved", response.getMessage());
        verify(bookingRepository, times(0)).save(any());
    }

    @Test
    void verifyOtpRejectsWrongVendor() {
        when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));
        booking.setOtpCode("1234");
        booking.setOtpExpiresAt(Instant.now().plus(1, ChronoUnit.HOURS));

        VerifyOtpRequest request = new VerifyOtpRequest();
        request.setBookingId(bookingId);
        request.setOtp("1234");

        assertThrows(NotFoundException.class,
                () -> bookingService.verifyOtp(request, UUID.randomUUID()));
    }

    @Test
    void verifyOtpLocksAfterMaxFailedAttempts() {
        when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));
        booking.setOtpCode("1234");
        booking.setOtpExpiresAt(Instant.now().plus(1, ChronoUnit.HOURS));

        VerifyOtpRequest request = new VerifyOtpRequest();
        request.setBookingId(bookingId);
        request.setOtp("0000");

        for (int i = 0; i < 3; i++) {
            assertThrows(BadRequestException.class,
                    () -> bookingService.verifyOtp(request, vendorId));
        }

        BadRequestException locked = assertThrows(BadRequestException.class,
                () -> bookingService.verifyOtp(request, vendorId));
        assertEquals("Too many invalid attempts", locked.getMessage());
    }

    @Test
    void verifyOtpSucceedsForOwningVendorAndResetsAttempts() {
        when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));
        when(bookingRepository.save(any(Booking.class))).thenAnswer(inv -> inv.getArgument(0));
        booking.setOtpCode("4321");
        booking.setOtpExpiresAt(Instant.now().plus(1, ChronoUnit.HOURS));

        VerifyOtpRequest bad = new VerifyOtpRequest();
        bad.setBookingId(bookingId);
        bad.setOtp("0000");
        assertThrows(BadRequestException.class, () -> bookingService.verifyOtp(bad, vendorId));

        VerifyOtpRequest good = new VerifyOtpRequest();
        good.setBookingId(bookingId);
        good.setOtp("4321");
        bookingService.verifyOtp(good, vendorId);

        verify(bookingRepository, times(1)).save(any(Booking.class));
    }

    @Test
    void generateOtpSkipsTeleServiceTypes() {
        booking.setServiceType("tele");
        when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));

        GenerateOtpRequest request = new GenerateOtpRequest();
        request.setBookingId(bookingId);

        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> bookingService.generateOtp(request, customerId));
        assertTrue(ex.getMessage().contains("tele"));
    }
}
