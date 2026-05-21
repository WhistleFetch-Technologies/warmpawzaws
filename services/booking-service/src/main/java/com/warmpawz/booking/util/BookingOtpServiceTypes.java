package com.warmpawz.booking.util;

import com.warmpawz.booking.entity.Booking;

import java.util.Set;

public final class BookingOtpServiceTypes {

    private static final Set<String> TELE_TYPES = Set.of(
            "tele",
            "online",
            "video_consultation",
            "tele_consultation"
    );

    private BookingOtpServiceTypes() {}

    public static boolean isTeleBooking(Booking booking, String requestServiceStyle) {
        String serviceType = booking.getServiceType();
        String serviceStyle = booking.getServiceStyle() != null
                ? booking.getServiceStyle()
                : requestServiceStyle;
        return isTeleType(serviceType) || isTeleType(serviceStyle);
    }

    private static boolean isTeleType(String value) {
        return value != null && TELE_TYPES.contains(value);
    }
}
