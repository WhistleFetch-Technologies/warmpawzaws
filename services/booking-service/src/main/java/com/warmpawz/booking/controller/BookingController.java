package com.warmpawz.booking.controller;

import com.warmpawz.booking.dto.common.CommonResponse;
import com.warmpawz.booking.dto.request.CancelBookingRequest;
import com.warmpawz.booking.dto.request.CreateBookingRequest;
import com.warmpawz.booking.dto.request.RefundPreviewRequest;
import com.warmpawz.booking.dto.request.RescheduleBookingRequest;
import com.warmpawz.booking.dto.request.UpdateBookingStatusRequest;
import com.warmpawz.booking.dto.response.BookingResponse;
import com.warmpawz.booking.dto.response.RefundPreviewResponse;
import com.warmpawz.booking.entity.BookingStatusHistory;
import com.warmpawz.booking.service.BookingService;
import com.warmpawz.booking.service.IdempotencyService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping({"/bookings", "/booking"})
@RequiredArgsConstructor
@Tag(name = "Booking", description = "Booking management APIs")
public class BookingController {

    private final BookingService bookingService;
    private final IdempotencyService idempotencyService;

    @PostMapping("/create")
    @Operation(summary = "Create a new booking")
    public ResponseEntity<CommonResponse<BookingResponse>> createBooking(
            @Valid @RequestBody CreateBookingRequest request,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey
    ) {
        String key = idempotencyKey != null ? idempotencyKey : request.getIdempotencyKey();
        BookingResponse response = idempotencyService.execute(
                "bookings/create",
                key,
                request,
                () -> bookingService.createBooking(request),
                BookingResponse.class
        );
        return ResponseEntity.ok(CommonResponse.success(response, "Booking created successfully"));
    }

    @GetMapping("/{bookingId}")
    @Operation(summary = "Get booking by ID")
    public ResponseEntity<CommonResponse<BookingResponse>> getBookingById(
            @PathVariable UUID bookingId
    ) {
        BookingResponse response = bookingService.getBookingById(bookingId);
        return ResponseEntity.ok(CommonResponse.success(response));
    }

    @GetMapping("/{bookingId}/history")
    @Operation(summary = "Get booking status history")
    public ResponseEntity<CommonResponse<List<BookingStatusHistory>>> getBookingHistory(
            @PathVariable UUID bookingId
    ) {
        List<BookingStatusHistory> history = bookingService.getBookingHistory(bookingId);
        return ResponseEntity.ok(CommonResponse.success(history));
    }

    @PutMapping("/{bookingId}/status")
    @Operation(summary = "Update booking status")
    public ResponseEntity<CommonResponse<BookingResponse>> updateBookingStatus(
            @PathVariable UUID bookingId,
            @Valid @RequestBody UpdateBookingStatusRequest request
    ) {
        BookingResponse response = bookingService.updateBookingStatus(bookingId, request);
        return ResponseEntity.ok(CommonResponse.success(response, "Booking status updated"));
    }

    @PostMapping("/{bookingId}/cancel")
    @Operation(summary = "Cancel a booking")
    public ResponseEntity<CommonResponse<BookingResponse>> cancelBooking(
            @PathVariable UUID bookingId,
            @RequestBody(required = false) CancelBookingRequest request
    ) {
        if (request == null) {
            request = new CancelBookingRequest();
        }
        BookingResponse response = bookingService.cancelBooking(bookingId, request);
        return ResponseEntity.ok(CommonResponse.success(response, "Booking cancelled"));
    }

    @PostMapping("/{bookingId}/reschedule")
    @Operation(summary = "Reschedule a booking")
    public ResponseEntity<CommonResponse<BookingResponse>> rescheduleBooking(
            @PathVariable UUID bookingId,
            @Valid @RequestBody RescheduleBookingRequest request
    ) {
        BookingResponse response = bookingService.rescheduleBooking(bookingId, request);
        return ResponseEntity.ok(CommonResponse.success(response, "Booking rescheduled"));
    }

    @PostMapping("/customer/bookings/refund-preview")
    @Operation(summary = "Preview refund for a booking cancellation")
    public ResponseEntity<CommonResponse<RefundPreviewResponse>> previewRefund(
            @Valid @RequestBody RefundPreviewRequest request
    ) {
        RefundPreviewResponse response = bookingService.previewRefund(request.getBookingId());
        return ResponseEntity.ok(CommonResponse.success(response));
    }

    @PostMapping("/{bookingId}/calculate-refund")
    @Operation(summary = "Calculate refund for a specific booking")
    public ResponseEntity<CommonResponse<RefundPreviewResponse>> calculateRefund(
            @PathVariable UUID bookingId
    ) {
        RefundPreviewResponse response = bookingService.previewRefund(bookingId);
        return ResponseEntity.ok(CommonResponse.success(response));
    }

    @PostMapping("/{bookingId}/cancel-with-refund")
    @Operation(summary = "Cancel booking and calculate refund")
    public ResponseEntity<CommonResponse<BookingResponse>> cancelWithRefund(
            @PathVariable UUID bookingId,
            @RequestBody(required = false) CancelBookingRequest request
    ) {
        BookingResponse response = bookingService.cancelBookingWithRefund(bookingId, request);
        return ResponseEntity.ok(CommonResponse.success(response, "Booking cancelled"));
    }
}
