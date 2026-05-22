package com.warmpawz.booking.controller;

import com.warmpawz.booking.dto.common.CommonResponse;
import com.warmpawz.booking.dto.request.GenerateOtpRequest;
import com.warmpawz.booking.dto.request.VerifyOtpRequest;
import com.warmpawz.booking.dto.response.BookingResponse;
import com.warmpawz.booking.dto.response.OtpResponse;
import com.warmpawz.booking.service.BookingService;
import com.warmpawz.booking.util.JwtPrincipalUtil;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@Tag(name = "Booking OTP")
public class BookingOtpController {

    private final BookingService bookingService;

    @PostMapping("/bookings/generate-otp")
    @Operation(summary = "Generate OTP for a booking (customer or vendor on the booking)")
    public ResponseEntity<CommonResponse<OtpResponse>> generateOtp(
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody GenerateOtpRequest request
    ) {
        OtpResponse response = bookingService.generateOtp(
                request,
                JwtPrincipalUtil.resolveCustomerPrincipal(jwt, request.getCustomerId())
        );
        return ResponseEntity.ok(CommonResponse.success(response));
    }

    @PostMapping("/bookings/verify-otp")
    @Operation(summary = "Verify OTP for a booking (vendor only)")
    public ResponseEntity<CommonResponse<BookingResponse>> verifyOtp(
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody VerifyOtpRequest request
    ) {
        BookingResponse response = bookingService.verifyOtp(request, JwtPrincipalUtil.extractUuid(jwt));
        return ResponseEntity.ok(CommonResponse.success(response, "OTP verified"));
    }
}
