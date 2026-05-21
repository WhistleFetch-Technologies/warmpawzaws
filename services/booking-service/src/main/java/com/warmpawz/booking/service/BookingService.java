package com.warmpawz.booking.service;

import com.warmpawz.booking.dto.request.CancelBookingRequest;
import com.warmpawz.booking.dto.request.CreateBookingRequest;
import com.warmpawz.booking.dto.request.CreateFollowUpRequest;
import com.warmpawz.booking.dto.request.GenerateOtpRequest;
import com.warmpawz.booking.dto.request.RescheduleBookingRequest;
import com.warmpawz.booking.dto.request.UpdateBookingStatusRequest;
import com.warmpawz.booking.dto.request.VendorCancelBookingRequest;
import com.warmpawz.booking.dto.request.VerifyOtpRequest;
import com.warmpawz.booking.dto.response.AvailableSlotResponse;
import com.warmpawz.booking.dto.response.BookingResponse;
import com.warmpawz.booking.dto.response.CancelBookingResult;
import com.warmpawz.booking.dto.response.OtpResponse;
import com.warmpawz.booking.dto.response.RefundPreviewResponse;
import com.warmpawz.booking.dto.response.ReschedulePolicyResponse;
import com.warmpawz.booking.entity.BookingStatusHistory;
import org.springframework.data.domain.Page;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface BookingService {

    BookingResponse createBooking(CreateBookingRequest request);

    BookingResponse getBookingById(UUID bookingId);

    BookingResponse getBookingByIdForCustomer(UUID bookingId, UUID customerId);

    Page<BookingResponse> getBookingsByCustomer(UUID customerId, int page, int size, String status);

    Page<BookingResponse> getBookingsByCustomerAndPet(UUID customerId, UUID petId, int page, int size);

    List<BookingStatusHistory> getBookingHistory(UUID bookingId);

    BookingResponse updateBookingStatus(UUID bookingId, UpdateBookingStatusRequest request);

    BookingResponse updateBookingStatusForVendor(UUID bookingId, UUID vendorId, UpdateBookingStatusRequest request);

    CancelBookingResult cancelBooking(UUID bookingId, UUID customerId, CancelBookingRequest request);

    BookingResponse rescheduleBooking(UUID bookingId, UUID customerId, RescheduleBookingRequest request);

    List<BookingResponse> getFollowUpEligibleBookings(UUID customerId);

    Page<BookingResponse> getBookingsByVendor(UUID vendorId, int page, int size, String status);

    List<BookingResponse> getTodayBookingsForVendor(UUID vendorId);

    BookingResponse getBookingDetailsForVendor(UUID bookingId, UUID vendorId);

    BookingResponse vendorConfirmBooking(UUID bookingId, UUID vendorId);

    BookingResponse vendorAcceptBooking(UUID bookingId, UUID vendorId);

    BookingResponse vendorRejectBooking(UUID bookingId, UUID vendorId, String reason);

    BookingResponse vendorCancelBooking(UUID bookingId, UUID vendorId, VendorCancelBookingRequest request);

    BookingResponse vendorDeclineBooking(UUID bookingId, UUID vendorId, String reason);

    OtpResponse generateOtp(GenerateOtpRequest request, UUID principalId);

    BookingResponse verifyOtp(VerifyOtpRequest request, UUID vendorId);

    List<AvailableSlotResponse> getAvailableSlots(UUID vendorId, LocalDate date,
                                                    String serviceStyle, Integer durationMinutes);

    BookingResponse createFollowUp(CreateFollowUpRequest request);

    ReschedulePolicyResponse getReschedulePolicy(UUID bookingId);

    RefundPreviewResponse previewRefund(UUID bookingId, UUID customerId);

    RefundPreviewResponse previewRefund(UUID bookingId, UUID customerId, String cancelledByType);

    CancelBookingResult cancelBookingWithRefund(UUID bookingId, UUID customerId, CancelBookingRequest request);
}
