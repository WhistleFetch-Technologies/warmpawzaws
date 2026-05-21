package com.warmpawz.booking.controller;

import com.warmpawz.booking.dto.common.CommonResponse;
import com.warmpawz.booking.dto.common.PaginatedResult;
import com.warmpawz.booking.dto.common.PaginationMetadata;
import com.warmpawz.booking.dto.request.UpdateBookingStatusRequest;
import com.warmpawz.booking.dto.request.VendorCancelBookingRequest;
import com.warmpawz.booking.dto.response.BookingResponse;
import com.warmpawz.booking.service.BookingService;
import com.warmpawz.booking.util.JwtPrincipalUtil;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
@Tag(name = "Vendor Bookings", description = "Vendor-facing booking operations")
public class VendorBookingController {

    private final BookingService bookingService;

    @GetMapping("/vendor/bookings/{vendorId}")
    @Operation(summary = "List bookings for a vendor (paginated)")
    public ResponseEntity<CommonResponse<PaginatedResult<BookingResponse>>> getBookingsByVendor(
            @PathVariable UUID vendorId,
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String status
    ) {
        JwtPrincipalUtil.requireSelf(jwt, vendorId);
        Page<BookingResponse> bookingsPage = bookingService.getBookingsByVendor(vendorId, page, size, status);
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

    @GetMapping("/vendor/{vendorId}/bookings")
    @Operation(summary = "List bookings for a vendor (alias)")
    public ResponseEntity<CommonResponse<PaginatedResult<BookingResponse>>> getBookingsByVendorAlias(
            @PathVariable UUID vendorId,
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String status
    ) {
        return getBookingsByVendor(vendorId, jwt, page, size, status);
    }

    @GetMapping("/vendor/{vendorId}/bookings/today")
    @Operation(summary = "Today's bookings for a vendor")
    public ResponseEntity<CommonResponse<List<BookingResponse>>> getTodayBookings(
            @PathVariable UUID vendorId,
            @AuthenticationPrincipal Jwt jwt
    ) {
        JwtPrincipalUtil.requireSelf(jwt, vendorId);
        List<BookingResponse> bookings = bookingService.getTodayBookingsForVendor(vendorId);
        return ResponseEntity.ok(CommonResponse.success(bookings));
    }

    @GetMapping("/vendor/bookings/{bookingId}/details")
    @Operation(summary = "Get booking details for vendor")
    public ResponseEntity<CommonResponse<BookingResponse>> getBookingDetails(
            @PathVariable UUID bookingId,
            @AuthenticationPrincipal Jwt jwt
    ) {
        UUID vendorId = JwtPrincipalUtil.extractUuid(jwt);
        BookingResponse response = bookingService.getBookingDetailsForVendor(bookingId, vendorId);
        return ResponseEntity.ok(CommonResponse.success(response));
    }

    @PutMapping("/vendor/bookings/{bookingId}/status")
    @Operation(summary = "Update booking status (vendor)")
    public ResponseEntity<CommonResponse<BookingResponse>> updateStatus(
            @PathVariable UUID bookingId,
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody UpdateBookingStatusRequest request
    ) {
        UUID vendorId = JwtPrincipalUtil.extractUuid(jwt);
        BookingResponse response = bookingService.updateBookingStatusForVendor(bookingId, vendorId, request);
        return ResponseEntity.ok(CommonResponse.success(response, "Booking status updated"));
    }

    @PostMapping("/vendor/bookings/{bookingId}/confirm")
    @Operation(summary = "Confirm a pending booking")
    public ResponseEntity<CommonResponse<BookingResponse>> confirm(
            @PathVariable UUID bookingId,
            @AuthenticationPrincipal Jwt jwt
    ) {
        UUID vendorId = JwtPrincipalUtil.extractUuid(jwt);
        BookingResponse response = bookingService.vendorConfirmBooking(bookingId, vendorId);
        return ResponseEntity.ok(CommonResponse.success(response, "Booking confirmed"));
    }

    @PostMapping("/vendor/bookings/{bookingId}/accept")
    @Operation(summary = "Accept a pending booking")
    public ResponseEntity<CommonResponse<BookingResponse>> accept(
            @PathVariable UUID bookingId,
            @AuthenticationPrincipal Jwt jwt
    ) {
        UUID vendorId = JwtPrincipalUtil.extractUuid(jwt);
        BookingResponse response = bookingService.vendorAcceptBooking(bookingId, vendorId);
        return ResponseEntity.ok(CommonResponse.success(response, "Booking accepted"));
    }

    @PostMapping("/vendor/bookings/{bookingId}/reject")
    @Operation(summary = "Reject a pending booking")
    public ResponseEntity<CommonResponse<BookingResponse>> reject(
            @PathVariable UUID bookingId,
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody(required = false) Map<String, String> body
    ) {
        UUID vendorId = JwtPrincipalUtil.extractUuid(jwt);
        String reason = body != null ? body.get("reason") : null;
        BookingResponse response = bookingService.vendorRejectBooking(bookingId, vendorId, reason);
        return ResponseEntity.ok(CommonResponse.success(response, "Booking rejected"));
    }

    @PostMapping("/vendor/bookings/{bookingId}/cancel")
    @Operation(summary = "Cancel a booking (vendor)")
    public ResponseEntity<CommonResponse<BookingResponse>> cancel(
            @PathVariable UUID bookingId,
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody VendorCancelBookingRequest request
    ) {
        UUID vendorId = JwtPrincipalUtil.extractUuid(jwt);
        BookingResponse response = bookingService.vendorCancelBooking(bookingId, vendorId, request);
        return ResponseEntity.ok(CommonResponse.success(response, "Booking cancelled"));
    }

    @PostMapping("/vendor/bookings/{bookingId}/decline")
    @Operation(summary = "Decline a pending booking")
    public ResponseEntity<CommonResponse<BookingResponse>> decline(
            @PathVariable UUID bookingId,
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody(required = false) Map<String, String> body
    ) {
        UUID vendorId = JwtPrincipalUtil.extractUuid(jwt);
        String reason = body != null ? body.get("reason") : null;
        BookingResponse response = bookingService.vendorDeclineBooking(bookingId, vendorId, reason);
        return ResponseEntity.ok(CommonResponse.success(response, "Booking declined"));
    }
}
