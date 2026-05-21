package com.warmpawz.booking.util;

import org.junit.jupiter.api.RepeatedTest;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class BookingOtpUtilTest {

    @RepeatedTest(20)
    void generateOtpCodeIsFourDigitsBetween1000And9999() {
        String otp = BookingOtpUtil.generateOtpCode();
        assertEquals(4, otp.length());
        int value = Integer.parseInt(otp);
        assertTrue(value >= 1000 && value <= 9999);
    }

    @Test
    void constantTimeEqualsMatchesEqualStrings() {
        assertTrue(BookingOtpUtil.constantTimeEquals("1234", "1234"));
    }

    @Test
    void constantTimeEqualsRejectsDifferentStrings() {
        assertFalse(BookingOtpUtil.constantTimeEquals("1234", "1235"));
    }

    @Test
    void constantTimeEqualsRejectsDifferentLengths() {
        assertFalse(BookingOtpUtil.constantTimeEquals("1234", "12345"));
    }

    @Test
    void constantTimeEqualsHandlesNull() {
        assertTrue(BookingOtpUtil.constantTimeEquals(null, null));
        assertFalse(BookingOtpUtil.constantTimeEquals("1234", null));
        assertFalse(BookingOtpUtil.constantTimeEquals(null, "1234"));
    }
}
