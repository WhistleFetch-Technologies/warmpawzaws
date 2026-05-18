package com.warmpawz.booking.controller;

import com.warmpawz.booking.dto.common.CommonResponse;
import com.warmpawz.booking.dto.request.GenerateOtpRequest;
import com.warmpawz.booking.dto.request.VerifyOtpRequest;
import com.warmpawz.booking.dto.response.BookingResponse;
import com.warmpawz.booking.dto.response.OtpResponse;
import com.warmpawz.booking.service.BookingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@Tag(name = "Booking OTP")
public class BookingOtpController {

    private final BookingService bookingService;

    // Rate limit: max 5 per bookingId per hour — enforcement at API Gateway level

    @PostMapping("/bookings/generate-otp")
    @Operation(summary = "Generate OTP for a booking")
    public ResponseEntity<CommonResponse<OtpResponse>> generateOtp(
            @RequestBody GenerateOtpRequest request
    ) {
        OtpResponse response = bookingService.generateOtp(request);
        return ResponseEntity.ok(CommonResponse.success(response));
    }

    @PostMapping("/bookings/verify-otp")
    @Operation(summary = "Verify OTP for a booking")
    public ResponseEntity<CommonResponse<BookingResponse>> verifyOtp(
            @RequestBody VerifyOtpRequest request
    ) {
        BookingResponse response = bookingService.verifyOtp(request);
        return ResponseEntity.ok(CommonResponse.success(response, "OTP verified"));
    }
}
