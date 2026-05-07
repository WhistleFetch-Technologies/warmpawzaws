package com.warmpawz.customer.service;

import com.warmpawz.customer.config.GoogleMapsProperties;
import com.warmpawz.customer.dto.request.AddressRequest;
import com.warmpawz.customer.dto.response.GoogleAddressResult;
import com.warmpawz.customer.exception.BadRequestException;
import com.warmpawz.customer.service.serviceimpl.GoogleMapsServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class GoogleMapsServiceImplTest {

    private GoogleMapsProperties properties;
    private RestTemplateBuilder builder;
    private RestTemplate restTemplate;
    private GoogleMapsServiceImpl service;

    @BeforeEach
    void setUp() {
        properties = new GoogleMapsProperties();
        properties.setApiKey("test-key");
        properties.setFallbackOnFailure(true);
        properties.setMaxRetries(0);
        builder = mock(RestTemplateBuilder.class);
        restTemplate = mock(RestTemplate.class);
        when(builder.setConnectTimeout(any(Duration.class))).thenReturn(builder);
        when(builder.setReadTimeout(any(Duration.class))).thenReturn(builder);
        when(builder.build()).thenReturn(restTemplate);
        service = new GoogleMapsServiceImpl(properties, builder);
    }

    @Test
    void geocodeSuccessNormalizesAddress() {
        when(restTemplate.getForObject(any(String.class), eq(Map.class))).thenReturn(okGeocodeBody());
        AddressRequest request = new AddressRequest();
        request.setAddressLine1("MG Road");
        request.setCity("Pune");
        request.setState("MH");
        request.setPincode("411001");

        Optional<GoogleAddressResult> result = service.normalize(request);

        assertTrue(result.isPresent());
        assertEquals("MG Road", result.get().getAddressLine1());
        assertEquals(18.52, result.get().getLatitude());
        assertEquals(73.85, result.get().getLongitude());
    }

    @Test
    void placeDetailsSuccessNormalizesAddress() {
        when(restTemplate.getForObject(any(String.class), eq(Map.class))).thenReturn(okPlaceBody());
        AddressRequest request = new AddressRequest();
        request.setPlaceId("place-123");

        Optional<GoogleAddressResult> result = service.normalize(request);

        assertTrue(result.isPresent());
        assertEquals("place-123", result.get().getPlaceId());
        assertEquals("Pune", result.get().getCity());
    }

    @Test
    void timeoutFailureFallsBackWhenConfigured() {
        when(restTemplate.getForObject(any(String.class), eq(Map.class))).thenThrow(new RestClientException("timeout"));
        AddressRequest request = new AddressRequest();
        request.setAddressLine1("MG Road");

        assertTrue(service.normalize(request).isEmpty());
    }

    @Test
    void geocodeStatusFailureFallsBackWhenConfigured() {
        when(restTemplate.getForObject(any(String.class), eq(Map.class))).thenReturn(Map.of("status", "ZERO_RESULTS"));
        AddressRequest request = new AddressRequest();
        request.setAddressLine1("Unknown road");

        assertTrue(service.normalize(request).isEmpty());
    }

    @Test
    void missingApiKeySkipsGoogleCall() {
        properties.setApiKey("");
        AddressRequest request = new AddressRequest();
        request.setAddressLine1("MG Road");

        assertTrue(service.normalize(request).isEmpty());
    }

    @Test
    void invalidPlaceIdReturnsControlledBadRequest() {
        when(restTemplate.getForObject(any(String.class), eq(Map.class))).thenReturn(Map.of("status", "ZERO_RESULTS"));
        AddressRequest request = new AddressRequest();
        request.setPlaceId("bad-place");

        assertThrows(BadRequestException.class, () -> service.normalize(request));
    }

    @Test
    void timeoutFailureWithoutFallbackReturnsControlledBadRequest() {
        properties.setFallbackOnFailure(false);
        when(restTemplate.getForObject(any(String.class), eq(Map.class))).thenThrow(new RestClientException("timeout"));
        AddressRequest request = new AddressRequest();
        request.setAddressLine1("MG Road");

        BadRequestException ex = assertThrows(BadRequestException.class, () -> service.normalize(request));
        assertEquals("Unable to validate address right now", ex.getMessage());
    }

    private Map<String, Object> okGeocodeBody() {
        return Map.of(
                "status", "OK",
                "results", List.of(result("place-123"))
        );
    }

    private Map<String, Object> okPlaceBody() {
        return Map.of(
                "status", "OK",
                "result", result("place-123")
        );
    }

    private Map<String, Object> result(String placeId) {
        return Map.of(
                "place_id", placeId,
                "formatted_address", "MG Road, Pune, Maharashtra 411001, India",
                "geometry", Map.of("location", Map.of("lat", 18.52, "lng", 73.85)),
                "address_components", List.of(
                        component("MG Road", "route"),
                        component("Pune", "locality"),
                        component("Maharashtra", "administrative_area_level_1"),
                        component("411001", "postal_code")
                )
        );
    }

    private Map<String, Object> component(String value, String type) {
        return Map.of("long_name", value, "types", List.of(type));
    }
}
