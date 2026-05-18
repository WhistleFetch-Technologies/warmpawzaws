package com.warmpawz.booking.controller;

import com.warmpawz.booking.dto.common.CommonResponse;
import com.warmpawz.booking.dto.response.AvailableSlotResponse;
import com.warmpawz.booking.dto.response.BookingResponse;
import com.warmpawz.booking.service.BookingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
@Tag(name = "Booking Slots")
public class BookingSlotController {

    private final BookingService bookingService;

    @GetMapping("/bookings/available-slots")
    @Operation(summary = "Get available time slots for a vendor on a date")
    public ResponseEntity<CommonResponse<List<AvailableSlotResponse>>> getSlots(
            @RequestParam UUID vendorId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) String serviceStyle,
            @RequestParam(required = false) Integer durationMinutes
    ) {
        List<AvailableSlotResponse> slots = bookingService.getAvailableSlots(
                vendorId, date, serviceStyle, durationMinutes);
        return ResponseEntity.ok(CommonResponse.success(slots));
    }

    @GetMapping("/vendor/available-slots")
    @Operation(summary = "Get available slots for a booking's vendor")
    public ResponseEntity<CommonResponse<List<AvailableSlotResponse>>> getVendorSlots(
            @RequestParam UUID bookingId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date
    ) {
        BookingResponse booking = bookingService.getBookingById(bookingId);
        LocalDate slotDate = date != null ? date : booking.getBookingDate();
        Integer duration = booking.getDurationMinutes();
        List<AvailableSlotResponse> slots = bookingService.getAvailableSlots(
                booking.getVendorId(), slotDate, booking.getServiceStyle(), duration);
        return ResponseEntity.ok(CommonResponse.success(slots));
    }
}
