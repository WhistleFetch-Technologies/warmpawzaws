package com.warmpawz.booking.config;

public final class CacheNames {

    private CacheNames() {
    }

    public static final String BOOKING_BY_ID = "booking-by-id";
    public static final String BOOKINGS_BY_CUSTOMER = "bookings-by-customer";
    public static final String BOOKING_SLOTS = "booking-slots";
    public static final String IDEMPOTENCY_RESPONSE = "idempotencyResponse";
}
