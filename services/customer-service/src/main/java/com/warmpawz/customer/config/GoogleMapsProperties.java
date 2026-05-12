package com.warmpawz.customer.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "google.maps")
@Data
public class GoogleMapsProperties {
    private String apiKey;
    private String region;
    private String country;
    private boolean fallbackOnFailure = true;
    private int timeoutMillis = 2000;
    private int maxRetries = 1;
}
