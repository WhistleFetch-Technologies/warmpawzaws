package com.warmpawz.customer.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Component
@Slf4j
public class BookingServiceClient {

    private final RestTemplateBuilder restTemplateBuilder;

    @Value("${app.booking-service.url:}")
    private String bookingServiceUrl;

    @Value("${app.booking-service.enabled:false}")
    private boolean bookingServiceEnabled;

    public BookingServiceClient(RestTemplateBuilder restTemplateBuilder) {
        this.restTemplateBuilder = restTemplateBuilder;
    }

    /**
     * GET /customer/{customerId}/pets/{petId}/bookings from booking-service
     * Returns the raw response map or empty map if service is disabled/unavailable
     */
    public Map<String, Object> getPetBookings(UUID customerId, UUID petId) {
        if (!bookingServiceEnabled || bookingServiceUrl == null || bookingServiceUrl.isBlank()) {
            log.debug("event=booking_service_disabled skipping_pet_bookings_call");
            return Map.of("bookings", List.of(), "stats", Map.of(),
                "message", "Booking service not configured");
        }
        try {
            RestTemplate restTemplate = restTemplateBuilder
                .setConnectTimeout(java.time.Duration.ofMillis(3000))
                .setReadTimeout(java.time.Duration.ofMillis(5000))
                .build();
            String url = bookingServiceUrl + "/customer/" + customerId + "/pets/" + petId + "/bookings";
            @SuppressWarnings("unchecked")
            Map<String, Object> response = restTemplate.getForObject(url, Map.class);
            if (response == null) {
                return Map.of("bookings", List.of(), "stats", Map.of());
            }
            Object data = response.get("data");
            if (data instanceof List<?> bookings) {
                return Map.of("bookings", bookings, "stats", Map.of());
            }
            return Map.of("bookings", List.of(), "stats", Map.of());
        } catch (Exception ex) {
            log.warn("event=booking_service_call_failed customerId={} petId={} error={}",
                customerId, petId, ex.getMessage());
            return Map.of("bookings", List.of(), "stats", Map.of(),
                "error", "booking_service_unavailable");
        }
    }
}
