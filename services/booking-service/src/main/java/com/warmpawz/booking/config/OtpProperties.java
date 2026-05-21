package com.warmpawz.booking.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "app.otp")
@Data
public class OtpProperties {

    /** Max new OTP generations per booking per rolling hour (in-memory; not distributed-safe). */
    private int generateMaxPerBookingPerHour = 5;

    /** Max failed verify attempts per booking before lockout until OTP expiry (in-memory). */
    private int verifyMaxAttempts = 5;
}
