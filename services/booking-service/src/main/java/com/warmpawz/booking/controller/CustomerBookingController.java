package com.warmpawz.booking.controller;

import com.warmpawz.booking.dto.common.CommonResponse;
import com.warmpawz.booking.dto.common.PaginatedResult;
import com.warmpawz.booking.dto.common.PaginationMetadata;
import com.warmpawz.booking.dto.request.CreateBookingRequest;
import com.warmpawz.booking.dto.response.BookingResponse;
import com.warmpawz.booking.service.BookingService;
import com.warmpawz.booking.service.IdempotencyService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
@Tag(name = "Customer Bookings", description = "Customer-facing booking APIs")
public class CustomerBookingController {

    private final BookingService bookingService;
    private final IdempotencyService idempotencyService;

    @PostMapping({"/customer/booking/create", "/customer/bookings/create"})
    @Operation(summary = "Create a booking (customer alias)")
    public ResponseEntity<CommonResponse<BookingResponse>> createBooking(
            @Valid @RequestBody CreateBookingRequest request,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey
    ) {
        String key = idempotencyKey != null ? idempotencyKey : request.getIdempotencyKey();
        BookingResponse response = idempotencyService.execute(
                "customer/bookings/create",
                key,
                request,
                () -> bookingService.createBooking(request),
                BookingResponse.class
        );
        return ResponseEntity.ok(CommonResponse.success(response, "Booking created successfully"));
    }

    @GetMapping("/customer/bookings/{bookingId}")
    @Operation(summary = "Get booking for authenticated customer")
    public ResponseEntity<CommonResponse<BookingResponse>> getBookingById(
            @PathVariable UUID bookingId,
            @RequestParam(required = false) UUID customerId
    ) {
        BookingResponse response;
        if (customerId != null) {
            response = bookingService.getBookingByIdForCustomer(bookingId, customerId);
        } else {
            response = bookingService.getBookingById(bookingId);
        }
        return ResponseEntity.ok(CommonResponse.success(response));
    }

    @GetMapping("/customer/{customerId}/bookings")
    @Operation(summary = "List bookings for a customer (paginated)")
    public ResponseEntity<CommonResponse<PaginatedResult<BookingResponse>>> getBookingsByCustomer(
            @PathVariable UUID customerId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String status
    ) {
        Page<BookingResponse> bookingsPage = bookingService.getBookingsByCustomer(customerId, page, size, status);
        PaginationMetadata meta = new PaginationMetadata(
                bookingsPage.getNumber(),
                bookingsPage.getSize(),
                bookingsPage.getTotalElements(),
                bookingsPage.getTotalPages(),
                bookingsPage.hasNext(),
                bookingsPage.hasPrevious()
        );
        PaginatedResult<BookingResponse> result = new PaginatedResult<>(bookingsPage.getContent(), meta);
        return ResponseEntity.ok(CommonResponse.success(result));
    }

    @GetMapping("/customer/{customerId}/pets/{petId}/bookings")
    @Operation(summary = "Get bookings for a specific pet belonging to a customer")
    public ResponseEntity<CommonResponse<List<BookingResponse>>> getBookingsByPet(
            @PathVariable UUID customerId,
            @PathVariable UUID petId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        Page<BookingResponse> result = bookingService.getBookingsByCustomerAndPet(
                customerId, petId, page, size);
        return ResponseEntity.ok(CommonResponse.success(result.getContent()));
    }

    @GetMapping("/customer/{customerId}/bookings/{bookingId}")
    @Operation(summary = "Get a specific booking for a customer")
    public ResponseEntity<CommonResponse<BookingResponse>> getBookingByIdForCustomer(
            @PathVariable UUID customerId,
            @PathVariable UUID bookingId
    ) {
        BookingResponse response = bookingService.getBookingByIdForCustomer(bookingId, customerId);
        return ResponseEntity.ok(CommonResponse.success(response));
    }

    @GetMapping("/customer/{customerId}/bookings/follow-up-eligible")
    @Operation(summary = "Get completed bookings eligible for follow-up (last 30 days)")
    public ResponseEntity<CommonResponse<List<BookingResponse>>> getFollowUpEligibleBookings(
            @PathVariable UUID customerId
    ) {
        List<BookingResponse> bookings = bookingService.getFollowUpEligibleBookings(customerId);
        return ResponseEntity.ok(CommonResponse.success(bookings));
    }
}
