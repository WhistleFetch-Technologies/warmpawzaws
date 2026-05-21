package com.warmpawz.booking.service;

import com.warmpawz.booking.entity.Booking;

import java.util.UUID;

/**
 * Mirrors Lambda {@code hasCustomerPaidCapture}: booking payment_status, wallet debits, or completed payments.
 */
public interface CustomerPaidCaptureChecker {

    boolean hasCustomerPaidCapture(UUID bookingId, Booking booking);
}
