package com.warmpawz.booking.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "app.sql")
@Data
public class SqlTelemetryProperties {
    private boolean metricsEnabled = true;
    private int warnThreshold = 20;
}
