package com.warmpawz.booking.controller;

import com.warmpawz.booking.dto.common.CommonResponse;
import com.warmpawz.booking.dto.request.CancelBookingRequest;
import com.warmpawz.booking.dto.request.CreateBookingRequest;
import com.warmpawz.booking.dto.request.RefundPreviewRequest;
import com.warmpawz.booking.dto.request.RescheduleBookingRequest;
import com.warmpawz.booking.dto.request.UpdateBookingStatusRequest;
import com.warmpawz.booking.dto.response.BookingRefundInfo;
import com.warmpawz.booking.dto.response.BookingResponse;
import com.warmpawz.booking.dto.response.CancelBookingResult;
import com.warmpawz.booking.dto.response.RefundPreviewResponse;
import com.warmpawz.booking.entity.BookingStatusHistory;
import com.warmpawz.booking.service.BookingService;
import com.warmpawz.booking.service.IdempotencyService;
import com.warmpawz.booking.util.JwtPrincipalUtil;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
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
    public ResponseEntity<CommonResponse<Map<String, Object>>> cancelBooking(
            @PathVariable UUID bookingId,
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody(required = false) CancelBookingRequest request
    ) {
        if (request == null) {
            request = new CancelBookingRequest();
        }
        UUID customerId = JwtPrincipalUtil.extractUuid(jwt);
        RefundPreviewResponse preview = bookingService.previewRefund(bookingId, customerId);
        CancelBookingResult result = bookingService.cancelBooking(bookingId, customerId, request);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("booking", result.getBooking());
        data.put("refund", toCancelRefundSummary(preview, result.getRefund()));
        return ResponseEntity.ok(CommonResponse.success(data, "Booking cancelled"));
    }

    @PostMapping("/{bookingId}/reschedule")
    @Operation(summary = "Reschedule a booking")
    public ResponseEntity<CommonResponse<BookingResponse>> rescheduleBooking(
            @PathVariable UUID bookingId,
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody RescheduleBookingRequest request
    ) {
        UUID customerId = JwtPrincipalUtil.extractUuid(jwt);
        BookingResponse response = bookingService.rescheduleBooking(bookingId, customerId, request);
        return ResponseEntity.ok(CommonResponse.success(response, "Booking rescheduled"));
    }

    @PostMapping("/customer/bookings/refund-preview")
    @Operation(summary = "Preview refund for a booking cancellation")
    public ResponseEntity<CommonResponse<Map<String, Object>>> previewRefund(
            @Valid @RequestBody RefundPreviewRequest request,
            @AuthenticationPrincipal Jwt jwt
    ) {
        UUID customerId = JwtPrincipalUtil.extractUuid(jwt);
        RefundPreviewResponse response = bookingService.previewRefund(request.getBookingId(), customerId);
        return ResponseEntity.ok(CommonResponse.success(Map.of("refund", toRefundPayload(response))));
    }

    @PostMapping("/{bookingId}/calculate-refund")
    @Operation(summary = "Calculate refund for a specific booking")
    public ResponseEntity<CommonResponse<Map<String, Object>>> calculateRefund(
            @PathVariable UUID bookingId,
            @AuthenticationPrincipal Jwt jwt
    ) {
        UUID customerId = JwtPrincipalUtil.extractUuid(jwt);
        RefundPreviewResponse response = bookingService.previewRefund(bookingId, customerId);
        return ResponseEntity.ok(CommonResponse.success(Map.of("refund", toRefundPayload(response))));
    }

    @PostMapping("/{bookingId}/cancel-with-refund")
    @Operation(summary = "Cancel booking and calculate refund")
    public ResponseEntity<CommonResponse<Map<String, Object>>> cancelWithRefund(
            @PathVariable UUID bookingId,
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody(required = false) CancelBookingRequest request
    ) {
        UUID customerId = JwtPrincipalUtil.extractUuid(jwt);
        RefundPreviewResponse preview = bookingService.previewRefund(bookingId, customerId);
        CancelBookingResult result = bookingService.cancelBookingWithRefund(bookingId, customerId, request);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("booking", result.getBooking());
        data.put("refund", toCancelRefundSummary(preview, result.getRefund()));
        return ResponseEntity.ok(CommonResponse.success(data, "Booking cancelled"));
    }

    private static Map<String, Object> toRefundPayload(RefundPreviewResponse preview) {
        Map<String, Object> refund = new LinkedHashMap<>();
        boolean eligible = preview.getRefundPercentage() > 0
                || (preview.getRefundAmount() != null
                && preview.getRefundAmount().compareTo(BigDecimal.ZERO) > 0);
        refund.put("eligible", eligible);
        refund.put("refundAmount", preview.getRefundAmount());
        refund.put("refundPercentage", preview.getRefundPercentage());
        refund.put("hoursUntil", preview.getHoursUntil() != null ? preview.getHoursUntil() : 0L);
        refund.put("cancellationFee", preview.getDeductionAmount());
        refund.put("message", preview.getReason());
        refund.put("policy", preview.getPolicy());
        refund.put("platformFeeApplies", false);
        refund.put("policyApplied", preview.getPolicy() != null && !"no_refund".equals(preview.getPolicy()));
        return refund;
    }

    private static Map<String, Object> toCancelRefundSummary(RefundPreviewResponse preview, BookingRefundInfo executed) {
        Map<String, Object> refund = new LinkedHashMap<>();
        if (executed != null) {
            refund.put("amount", executed.getAmount());
            refund.put("percentage", executed.getPercentage());
            refund.put("method", executed.getMethod());
            refund.put("status", executed.getStatus());
            refund.put("message", executed.getMessage());
            if (executed.getRefundId() != null) {
                refund.put("refundId", executed.getRefundId());
            }
            return refund;
        }
        refund.put("message", preview.getReason());
        refund.put("amount", preview.getRefundAmount());
        refund.put("percentage", preview.getRefundPercentage());
        return refund;
    }
}
