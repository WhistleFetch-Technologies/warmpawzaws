package com.warmpawz.booking.util;

import com.warmpawz.booking.exception.BadRequestException;

import java.time.LocalTime;
import java.time.format.DateTimeFormatter;

public final class BookingTimeUtil {

    private static final DateTimeFormatter HH_MM = DateTimeFormatter.ofPattern("HH:mm");

    private BookingTimeUtil() {
    }

    public static LocalTime parseBookingTime(String bookingTime) {
        if (bookingTime == null || bookingTime.isBlank()) {
            throw new BadRequestException("bookingTime is required");
        }
        String trimmed = bookingTime.trim();
        if (trimmed.length() >= 5 && trimmed.charAt(2) == ':') {
            return LocalTime.parse(trimmed.substring(0, 5), HH_MM);
        }
        return LocalTime.parse(trimmed);
    }

    public static String formatBookingTime(LocalTime time) {
        return time != null ? time.format(HH_MM) : null;
    }

    public static int toMinutes(LocalTime time) {
        return time.getHour() * 60 + time.getMinute();
    }
}
