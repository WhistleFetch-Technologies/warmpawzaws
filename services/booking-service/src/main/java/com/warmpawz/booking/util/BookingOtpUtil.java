package com.warmpawz.booking.util;

import java.security.SecureRandom;

public final class BookingOtpUtil {

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private BookingOtpUtil() {}

    /**
     * 4-digit OTP (1000–9999), aligned with Lambda {@code generateBookingOTP()}.
     */
    public static String generateOtpCode() {
        return String.valueOf(1000 + SECURE_RANDOM.nextInt(9000));
    }

    /**
     * Constant-time string comparison for OTP verification.
     */
    public static boolean constantTimeEquals(String a, String b) {
        if (a == null || b == null) {
            return a == b;
        }
        byte[] aBytes = a.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        byte[] bBytes = b.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        if (aBytes.length != bBytes.length) {
            return false;
        }
        int result = 0;
        for (int i = 0; i < aBytes.length; i++) {
            result |= aBytes[i] ^ bBytes[i];
        }
        return result == 0;
    }
}
