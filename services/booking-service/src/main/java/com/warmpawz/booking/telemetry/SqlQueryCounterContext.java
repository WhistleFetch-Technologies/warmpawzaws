package com.warmpawz.booking.telemetry;

import java.util.concurrent.atomic.AtomicInteger;

public final class SqlQueryCounterContext {

    private static final ThreadLocal<AtomicInteger> COUNTER = new ThreadLocal<>();

    private SqlQueryCounterContext() {
    }

    public static void begin() {
        COUNTER.set(new AtomicInteger(0));
    }

    public static int incrementAndGet() {
        AtomicInteger counter = COUNTER.get();
        return counter == null ? 0 : counter.incrementAndGet();
    }

    public static int getCount() {
        AtomicInteger counter = COUNTER.get();
        return counter == null ? 0 : counter.get();
    }

    public static void clear() {
        COUNTER.remove();
    }
}
