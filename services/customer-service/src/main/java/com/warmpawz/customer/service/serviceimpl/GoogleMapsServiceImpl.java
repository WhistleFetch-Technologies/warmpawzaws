package com.warmpawz.customer.service.serviceimpl;

import com.warmpawz.customer.config.GoogleMapsProperties;
import com.warmpawz.customer.dto.request.AddressRequest;
import com.warmpawz.customer.dto.response.GoogleAddressResult;
import com.warmpawz.customer.exception.BadRequestException;
import com.warmpawz.customer.service.GoogleMapsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@Slf4j
@RequiredArgsConstructor
public class GoogleMapsServiceImpl implements GoogleMapsService {

    private static final String GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";
    private static final String PLACE_DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json";

    private final GoogleMapsProperties properties;
    private final RestTemplateBuilder restTemplateBuilder;

    @Override
    public Optional<GoogleAddressResult> normalize(AddressRequest request) {
        if (!hasApiKey()) {
            return Optional.empty();
        }
        if (hasText(request.getPlaceId())) {
            return callWithRetry(() -> placeDetails(request.getPlaceId()));
        }
        if (request.getLatitude() != null && request.getLongitude() != null) {
            return Optional.of(fromRequest(request)
                    .latitude(request.getLatitude())
                    .longitude(request.getLongitude())
                    .build());
        }
        String addressText = buildAddressText(request);
        if (!hasText(addressText)) {
            return Optional.empty();
        }
        return callWithRetry(() -> geocode(addressText));
    }

    private Optional<GoogleAddressResult> callWithRetry(GoogleCall call) {
        int attempts = Math.max(1, properties.getMaxRetries() + 1);
        for (int attempt = 1; attempt <= attempts; attempt++) {
            try {
                return Optional.of(call.execute());
            } catch (BadRequestException ex) {
                throw ex;
            } catch (RestClientException ex) {
                log.warn("Google address normalization failed on attempt {}/{}", attempt, attempts);
                if (attempt == attempts) {
                    if (properties.isFallbackOnFailure()) {
                        log.warn("Google address normalization fallback enabled, using request-provided address data");
                        return Optional.empty();
                    }
                    throw new BadRequestException("Unable to validate address right now");
                }
            }
        }
        return Optional.empty();
    }

    private GoogleAddressResult geocode(String addressText) {
        String url = UriComponentsBuilder.fromHttpUrl(GEOCODE_URL)
                .queryParam("address", addressText)
                .queryParamIfPresent("region", Optional.ofNullable(blankToNull(properties.getRegion())))
                .queryParamIfPresent("components", countryComponent())
                .queryParam("key", properties.getApiKey())
                .build()
                .toUriString();
        return parseFirstResult(getForMap(url), "Address could not be geocoded");
    }

    private GoogleAddressResult placeDetails(String placeId) {
        String url = UriComponentsBuilder.fromHttpUrl(PLACE_DETAILS_URL)
                .queryParam("place_id", placeId)
                .queryParam("fields", "place_id,formatted_address,geometry,address_components")
                .queryParam("key", properties.getApiKey())
                .build()
                .toUriString();
        Map<String, Object> body = getForMap(url);
        if (!"OK".equals(body.get("status")) || !(body.get("result") instanceof Map<?, ?> rawResult)) {
            log.warn("Google place details returned non-OK status: {}", string(body.get("status")));
            throw new BadRequestException("Invalid placeId");
        }
        return parseResult(castMap(rawResult), "Invalid placeId");
    }

    private Map<String, Object> getForMap(String url) {
        RestTemplate restTemplate = restTemplateBuilder
                .setConnectTimeout(Duration.ofMillis(properties.getTimeoutMillis()))
                .setReadTimeout(Duration.ofMillis(properties.getTimeoutMillis()))
                .build();
        Map<String, Object> body = restTemplate.getForObject(url, Map.class);
        if (body == null) throw new RestClientException("Empty Google Maps response");
        return body;
    }

    private GoogleAddressResult parseFirstResult(Map<String, Object> body, String errorMessage) {
        if (!"OK".equals(body.get("status")) || !(body.get("results") instanceof List<?> results) || results.isEmpty()) {
            log.warn("Google geocode returned non-OK status: {}", string(body.get("status")));
            if (properties.isFallbackOnFailure()) throw new RestClientException(errorMessage);
            throw new BadRequestException(errorMessage);
        }
        Object first = results.get(0);
        if (!(first instanceof Map<?, ?> rawResult)) {
            throw new RestClientException(errorMessage);
        }
        return parseResult(castMap(rawResult), errorMessage);
    }

    private GoogleAddressResult parseResult(Map<String, Object> result, String errorMessage) {
        Map<String, String> components = components(result.get("address_components"));
        Map<String, Object> geometry = castMap(result.get("geometry"));
        Map<String, Object> location = geometry == null ? null : castMap(geometry.get("location"));
        if (location == null) throw new RestClientException(errorMessage);

        String streetNumber = components.get("street_number");
        String route = components.get("route");
        String line1 = join(streetNumber, route);
        String formatted = string(result.get("formatted_address"));
        if (!hasText(line1)) line1 = formatted;

        String rawState = components.get("administrative_area_level_1");
        String rawPin = components.get("postal_code");

        return GoogleAddressResult.builder()
                .addressLine1(line1)
                .city(firstNonBlank(components.get("locality"), components.get("administrative_area_level_3")))
                .state(stripDuplicatePincodeFromState(rawState, rawPin))
                .pincode(rawPin)
                .formattedAddress(formatted)
                .placeId(string(result.get("place_id")))
                .latitude(number(location.get("lat")))
                .longitude(number(location.get("lng")))
                .build();
    }

    private GoogleAddressResult.GoogleAddressResultBuilder fromRequest(AddressRequest request) {
        return GoogleAddressResult.builder()
                .addressLine1(request.getAddressLine1())
                .addressLine2(request.getAddressLine2())
                .city(request.getCity())
                .state(request.getState())
                .pincode(request.getPincode())
                .formattedAddress(request.getFormattedAddress())
                .placeId(request.getPlaceId());
    }

    private String buildAddressText(AddressRequest request) {
        return join(request.getFormattedAddress(), request.getAddressLine1(), request.getAddressLine2(),
                request.getCity(), request.getState(), request.getPincode());
    }

    private Map<String, String> components(Object rawComponents) {
        Map<String, String> values = new java.util.HashMap<>();
        if (!(rawComponents instanceof List<?> components)) return values;
        for (Object component : components) {
            Map<String, Object> item = castMap(component);
            if (item == null || !(item.get("types") instanceof List<?> types)) continue;
            String longName = string(item.get("long_name"));
            for (Object type : types) values.putIfAbsent(String.valueOf(type), longName);
        }
        return values;
    }

    private Optional<String> countryComponent() {
        String country = blankToNull(properties.getCountry());
        return country == null ? Optional.empty() : Optional.of("country:" + country);
    }

    private boolean hasApiKey() {
        return hasText(properties.getApiKey());
    }

    private static Map<String, Object> castMap(Object value) {
        if (!(value instanceof Map<?, ?> raw)) return null;
        Map<String, Object> result = new java.util.HashMap<>();
        raw.forEach((key, mapValue) -> result.put(String.valueOf(key), mapValue));
        return result;
    }

    private static String join(String... parts) {
        return java.util.Arrays.stream(parts)
                .filter(GoogleMapsServiceImpl::hasText)
                .reduce((left, right) -> left + ", " + right)
                .orElse(null);
    }

    private static String firstNonBlank(String first, String second) {
        return hasText(first) ? first : second;
    }

    /** When Google echoes postal digits on {@code administrative_area_level_1}, keep pincode in its own field only. */
    private static String stripDuplicatePincodeFromState(String state, String pincode) {
        if (!hasText(state)) {
            return state;
        }
        String s = state.trim();
        if (!hasText(pincode)) {
            return s;
        }
        String pc = pincode.replaceAll("\\D", "");
        if (pc.length() < 4) {
            return s;
        }
        if (!s.endsWith(pc)) {
            return s;
        }
        String prefix = s.substring(0, s.length() - pc.length());
        if (!hasText(prefix)) {
            return s;
        }
        char last = prefix.charAt(prefix.length() - 1);
        if (!Character.isWhitespace(last) && last != ',' && last != ';' && last != '-') {
            return s;
        }
        return prefix.replaceAll("[\\s,;-]+$", "").trim();
    }

    private static String blankToNull(String value) {
        return hasText(value) ? value : null;
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private static String string(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private static Double number(Object value) {
        if (value instanceof Number number) return number.doubleValue();
        if (value instanceof String text && hasText(text)) return Double.valueOf(text);
        return null;
    }

    @FunctionalInterface
    private interface GoogleCall {
        GoogleAddressResult execute();
    }
}
