package com.warmpawz.booking.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import software.amazon.awssdk.services.sns.SnsClient;
import software.amazon.awssdk.services.sns.model.PublishResponse;

import java.math.BigDecimal;
import java.util.UUID;
import java.util.function.Consumer;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SnsEventPublisherTest {

    private static final String CREATED_TOPIC = "arn:aws:sns:ap-south-1:123456789012:booking-created";
    private static final String STATUS_TOPIC = "arn:aws:sns:ap-south-1:123456789012:booking-status-updated";

    @Mock
    private SnsClient snsClient;

    private SnsEventPublisher publisher;

    @BeforeEach
    void setUp() {
        ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();
        publisher = new SnsEventPublisher(snsClient, objectMapper);
        ReflectionTestUtils.setField(publisher, "snsEnabled", true);
        ReflectionTestUtils.setField(publisher, "bookingCreatedTopicArn", CREATED_TOPIC);
        ReflectionTestUtils.setField(publisher, "bookingStatusUpdatedTopicArn", STATUS_TOPIC);
    }

    private void stubPublish() {
        when(snsClient.publish(any(Consumer.class)))
                .thenReturn(PublishResponse.builder().messageId("test-message-id").build());
    }

    @Test
    void publishBookingCreated_usesInjectedSnsClientOnce() {
        stubPublish();
        UUID bookingId = UUID.randomUUID();
        UUID customerId = UUID.randomUUID();
        UUID vendorId = UUID.randomUUID();

        publisher.publishBookingCreated(bookingId, customerId, vendorId, "CONFIRMED", BigDecimal.TEN);

        verify(snsClient, times(1)).publish(any(Consumer.class));
        verifyNoMoreInteractions(snsClient);
    }

    @Test
    void publishBookingStatusUpdated_usesInjectedSnsClientOnce() {
        stubPublish();
        UUID bookingId = UUID.randomUUID();
        UUID customerId = UUID.randomUUID();
        UUID vendorId = UUID.randomUUID();

        publisher.publishBookingStatusUpdated(bookingId, "PENDING", "CONFIRMED", customerId, vendorId);

        verify(snsClient, times(1)).publish(any(Consumer.class));
        verifyNoMoreInteractions(snsClient);
    }

    @Test
    void publishBookingCreated_skipsWhenSnsDisabled() {
        ReflectionTestUtils.setField(publisher, "snsEnabled", false);

        publisher.publishBookingCreated(
                UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), "CONFIRMED", BigDecimal.ONE);

        verify(snsClient, never()).publish(any(Consumer.class));
    }
}
