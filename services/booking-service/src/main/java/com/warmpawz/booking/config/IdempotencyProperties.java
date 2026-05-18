package com.warmpawz.booking.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "app.idempotency")
@Data
public class IdempotencyProperties {
    private String provider = "db";
    private long ttlSeconds = 300;
    private long inProgressWaitMillis = 2000;
    private long inProgressPollMillis = 50;
}
