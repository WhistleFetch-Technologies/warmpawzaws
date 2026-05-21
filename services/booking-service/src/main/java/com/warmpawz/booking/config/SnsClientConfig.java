package com.warmpawz.booking.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.sns.SnsClient;

@Configuration
public class SnsClientConfig {

    @Bean(destroyMethod = "close")
    SnsClient snsClient(@Value("${app.sns.region:ap-south-1}") String region) {
        return SnsClient.builder()
                .region(Region.of(region))
                .build();
    }
}
