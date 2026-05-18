package com.warmpawz.booking.enums;

public final class BookingStatus {

    private BookingStatus() {
    }

    public static final String PENDING = "pending";
    public static final String PENDING_PAYMENT = "pending_payment";
    public static final String CONFIRMED = "confirmed";
    public static final String SCHEDULED = "scheduled";
    public static final String IN_PROGRESS = "in_progress";
    public static final String COMPLETED = "completed";
    public static final String CANCELLED = "cancelled";
    public static final String NO_SHOW = "no_show";
    public static final String RESCHEDULED = "rescheduled";
    public static final String PARTIALLY_COMPLETED = "partially_completed";
    public static final String VENDOR_ON_WAY = "vendor_on_way";
    public static final String IN_TRANSIT = "in_transit";
    public static final String ARRIVED = "arrived";
}
