package com.warmpawz.booking.controller;

import com.warmpawz.booking.dto.common.CommonResponse;
import com.warmpawz.booking.dto.request.CreateFollowUpRequest;
import com.warmpawz.booking.dto.response.BookingResponse;
import com.warmpawz.booking.dto.response.ReschedulePolicyResponse;
import com.warmpawz.booking.service.BookingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequiredArgsConstructor
@Tag(name = "Follow-up Bookings")
public class FollowUpController {

    private final BookingService bookingService;

    @PostMapping("/followup/create")
    @Operation(summary = "Create a follow-up booking from a completed booking")
    public ResponseEntity<CommonResponse<BookingResponse>> createFollowUp(
            @Valid @RequestBody CreateFollowUpRequest request
    ) {
        BookingResponse response = bookingService.createFollowUp(request);
        return ResponseEntity.ok(CommonResponse.success(response, "Follow-up booking created"));
    }

    @GetMapping("/vendor/reschedule-policy")
    @Operation(summary = "Get reschedule policy for a booking")
    public ResponseEntity<CommonResponse<ReschedulePolicyResponse>> getReschedulePolicy(
            @RequestParam UUID bookingId
    ) {
        ReschedulePolicyResponse response = bookingService.getReschedulePolicy(bookingId);
        return ResponseEntity.ok(CommonResponse.success(response));
    }
}
