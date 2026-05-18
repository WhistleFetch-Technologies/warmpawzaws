package com.warmpawz.booking.enums;

public final class BookingPaymentStatus {

    private BookingPaymentStatus() {
    }

    public static final String PENDING = "pending";
    public static final String PARTIAL = "partial";
    public static final String PAID = "paid";
    public static final String COMPLETED = "completed";
    public static final String REFUNDED = "refunded";
    public static final String PARTIALLY_REFUNDED = "partially_refunded";
    public static final String FAILED = "failed";
}
