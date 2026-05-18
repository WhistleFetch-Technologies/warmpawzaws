package com.warmpawz.booking.exception;

import java.util.Collections;
import java.util.Map;

public class BadRequestException extends RuntimeException {

    private final Map<String, Object> details;

    public BadRequestException(String message) {
        this(message, Collections.emptyMap());
    }

    public BadRequestException(String message, Map<String, Object> details) {
        super(message);
        this.details = details != null ? details : Collections.emptyMap();
    }

    public Map<String, Object> getDetails() {
        return details;
    }
}
