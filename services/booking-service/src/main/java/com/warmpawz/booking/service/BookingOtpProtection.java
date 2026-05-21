package com.warmpawz.booking.service;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.warmpawz.booking.config.OtpProperties;
import com.warmpawz.booking.exception.BadRequestException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * In-memory OTP abuse protection (Caffeine). Not safe across multiple instances;
 * use API Gateway limits and/or DB counters for distributed production.
 */
@Component
@Slf4j
public class BookingOtpProtection {

    private static final int GENERATE_CACHE_MAX_SIZE = 10_000;
    private static final int VERIFY_CACHE_MAX_SIZE = 10_000;

    private final OtpProperties otpProperties;
    private final Cache<UUID, GenerateWindow> generateWindows;
    private final Cache<UUID, Integer> verifyAttempts;

    public BookingOtpProtection(OtpProperties otpProperties) {
        this.otpProperties = otpProperties;
        this.generateWindows = Caffeine.newBuilder()
                .maximumSize(GENERATE_CACHE_MAX_SIZE)
                .expireAfterAccess(2, TimeUnit.HOURS)
                .build();
        this.verifyAttempts = Caffeine.newBuilder()
                .maximumSize(VERIFY_CACHE_MAX_SIZE)
                .expireAfterWrite(24, TimeUnit.HOURS)
                .build();
    }

    public void assertGenerateAllowed(UUID bookingId) {
        GenerateWindow window = currentGenerateWindow(bookingId);
        if (window.count() >= otpProperties.getGenerateMaxPerBookingPerHour()) {
            throw new BadRequestException("Too many OTP requests; try again later");
        }
    }

    public void recordGenerate(UUID bookingId) {
        GenerateWindow window = currentGenerateWindow(bookingId);
        generateWindows.put(bookingId, new GenerateWindow(window.count() + 1, window.windowStart()));
    }

    public void assertVerifyAllowed(UUID bookingId) {
        Integer attempts = verifyAttempts.getIfPresent(bookingId);
        if (attempts != null && attempts >= otpProperties.getVerifyMaxAttempts()) {
            throw new BadRequestException("Too many invalid attempts");
        }
    }

    public void recordFailedVerify(UUID bookingId, Instant otpExpiresAt) {
        int next = verifyAttempts.getIfPresent(bookingId) == null ? 1 : verifyAttempts.getIfPresent(bookingId) + 1;
        verifyAttempts.put(bookingId, next);
        if (otpExpiresAt != null) {
            long secondsUntilExpiry = ChronoUnit.SECONDS.between(Instant.now(), otpExpiresAt);
            if (secondsUntilExpiry > 0) {
                log.debug("event=otp_verify_attempt bookingId={} attempts={} ttlSeconds={}",
                        bookingId, next, secondsUntilExpiry);
            }
        }
    }

    public void resetVerifyAttempts(UUID bookingId) {
        verifyAttempts.invalidate(bookingId);
    }

    private GenerateWindow currentGenerateWindow(UUID bookingId) {
        GenerateWindow window = generateWindows.getIfPresent(bookingId);
        Instant now = Instant.now();
        if (window == null || ChronoUnit.HOURS.between(window.windowStart(), now) >= 1) {
            return new GenerateWindow(0, now);
        }
        return window;
    }

    private record GenerateWindow(int count, Instant windowStart) {}
}
