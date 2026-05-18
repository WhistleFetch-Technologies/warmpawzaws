package com.warmpawz.booking.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.sns.SnsClient;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Component
@Slf4j
public class SnsEventPublisher {

    @Value("${app.sns.enabled:false}")
    private boolean snsEnabled;

    @Value("${app.sns.booking-created-topic-arn:}")
    private String bookingCreatedTopicArn;

    @Value("${app.sns.booking-status-updated-topic-arn:}")
    private String bookingStatusUpdatedTopicArn;

    @Value("${app.sns.region:ap-south-1}")
    private String region;

    private final ObjectMapper objectMapper =
            new ObjectMapper().registerModule(new JavaTimeModule());

    public void publishBookingCreated(UUID bookingId, UUID customerId,
            UUID vendorId, String status, BigDecimal totalAmount) {
        if (!snsEnabled || bookingCreatedTopicArn == null || bookingCreatedTopicArn.isBlank()) {
            log.debug("event=sns_disabled skipping BOOKING_CREATED for bookingId={}", bookingId);
            return;
        }
        try {
            Map<String, Object> envelope = Map.of(
                    "eventType", "BOOKING_CREATED",
                    "eventId", UUID.randomUUID().toString(),
                    "eventTimestamp", Instant.now().toString(),
                    "eventSource", "booking-service",
                    "eventVersion", "1.0",
                    "data", Map.of(
                            "bookingId", bookingId.toString(),
                            "customerId", customerId.toString(),
                            "vendorId", vendorId.toString(),
                            "status", status,
                            "totalAmount", totalAmount != null ? totalAmount : 0
                    )
            );
            String message = objectMapper.writeValueAsString(envelope);
            SnsClient snsClient = SnsClient.builder()
                    .region(Region.of(region))
                    .build();
            snsClient.publish(r -> r.topicArn(bookingCreatedTopicArn).message(message));
            log.info("event=sns_published type=BOOKING_CREATED bookingId={}", bookingId);
        } catch (Exception ex) {
            log.warn("event=sns_publish_failed type=BOOKING_CREATED bookingId={} error={}",
                    bookingId, ex.getMessage());
        }
    }

    public void publishBookingStatusUpdated(UUID bookingId, String fromStatus,
            String toStatus, UUID customerId, UUID vendorId) {
        if (!snsEnabled || bookingStatusUpdatedTopicArn == null || bookingStatusUpdatedTopicArn.isBlank()) {
            log.debug("event=sns_disabled skipping BOOKING_STATUS_UPDATED bookingId={}", bookingId);
            return;
        }
        try {
            Map<String, Object> envelope = Map.of(
                    "eventType", "BOOKING_STATUS_UPDATED",
                    "eventId", UUID.randomUUID().toString(),
                    "eventTimestamp", Instant.now().toString(),
                    "eventSource", "booking-service",
                    "eventVersion", "1.0",
                    "data", Map.of(
                            "bookingId", bookingId.toString(),
                            "fromStatus", fromStatus != null ? fromStatus : "",
                            "toStatus", toStatus,
                            "customerId", customerId != null ? customerId.toString() : "",
                            "vendorId", vendorId != null ? vendorId.toString() : ""
                    )
            );
            String message = objectMapper.writeValueAsString(envelope);
            SnsClient snsClient = SnsClient.builder()
                    .region(Region.of(region))
                    .build();
            snsClient.publish(r -> r.topicArn(bookingStatusUpdatedTopicArn).message(message));
            log.info("event=sns_published type=BOOKING_STATUS_UPDATED bookingId={} {}->{}",
                    bookingId, fromStatus, toStatus);
        } catch (Exception ex) {
            log.warn("event=sns_publish_failed type=BOOKING_STATUS_UPDATED bookingId={} error={}",
                    bookingId, ex.getMessage());
        }
    }
}
