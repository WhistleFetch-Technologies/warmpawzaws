package com.warmpawz.customer.mapper;

import com.warmpawz.customer.dto.request.*;
import com.warmpawz.customer.dto.response.*;
import com.warmpawz.customer.entity.*;

import java.net.URI;
import java.net.URISyntaxException;
import java.nio.charset.StandardCharsets;
import java.net.URLEncoder;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

public class CustomerMapper {

    /**
     * Customer/pet photo URLs are persisted as 7-day SigV4 presigned URLs. The signature plus
     * the embedded STS session token both expire in well under that, so by the time the client
     * loads the image the URL is dead. Rewriting through the API gateway's
     * GET /storage/media?url=<encoded> endpoint causes the Lambda backend to 302 to a fresh
     * presigned URL on every request, which makes images self-healing without any client work.
     *
     * Configured via API_BASE_URL on the ECS task; if unset, the rewrite is a no-op so legacy
     * deploys continue to behave the same.
     */
    private static final String API_BASE_URL = resolveApiBaseUrl();

    private static String resolveApiBaseUrl() {
        String value = System.getenv("API_BASE_URL");
        if (value == null) value = System.getProperty("app.api.base-url");
        if (value == null || value.isBlank()) return "";
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }

    static String rewriteMediaUrl(String url) {
        if (url == null || url.isBlank()) return url;
        if (API_BASE_URL.isEmpty()) return url;
        if (!url.contains("amazonaws.com")) return url;
        String key;
        try {
            URI parsed = new URI(url);
            String host = parsed.getHost();
            if (host == null || !host.contains("amazonaws.com")) return url;
            key = parsed.getPath();
            if (key == null || key.isBlank()) return url;
            if (key.startsWith("/")) key = key.substring(1);
        } catch (URISyntaxException ex) {
            return url;
        }
        // The Lambda route is GET /storage/media/<key> and decodes the key with decodeURIComponent.
        // We must keep '/' as literal separators so the path matches Hono's wildcard, but escape
        // any genuinely unsafe characters in each segment.
        StringBuilder encoded = new StringBuilder(key.length());
        boolean first = true;
        for (String segment : key.split("/", -1)) {
            if (!first) encoded.append('/');
            encoded.append(URLEncoder.encode(segment, StandardCharsets.UTF_8).replace("+", "%20"));
            first = false;
        }
        return API_BASE_URL + "/storage/media/" + encoded;
    }

    // =========================
    // CUSTOMER → RESPONSE
    // =========================
    public static CustomerResponse toCustomerResponse(Customer customer) {
        if (customer == null) return null;

        CustomerResponse response = new CustomerResponse();
        response.setId(customer.getId());
        response.setPhone(customer.getPhone());
        response.setName(customer.getFullName());
        response.setFullName(customer.getFullName());
        String[] splitName = splitName(customer.getFullName());
        response.setFirstName(splitName[0]);
        response.setLastName(splitName[1]);
        response.setEmail(customer.getEmail());
        String photoUrl = rewriteMediaUrl(customer.getProfilePhotoUrl());
        response.setPhoto(photoUrl);
        response.setProfilePhotoUrl(photoUrl);
        response.setAddress(customer.getAddress());
        response.setCity(customer.getCity());
        response.setState(customer.getState());
        response.setPincode(customer.getPincode());
        applyDefaultAddressDetails(customer, response::setAddressLine1, response::setAddressLine2,
                response::setHouseNo, response::setFlatNo, response::setFloor,
                response::setStreetName, response::setApartmentName, response::setLandmark);
        response.setStatus(customer.getStatus());
        response.setOnboardingStatus(customer.getOnboardingStatus());
        response.setProfileCompleted(customer.isProfileCompleted());
        response.setCreatedAt(toString(customer.getCreatedAt()));

        return response;
    }

    // =========================
    // CUSTOMER → UNIFIED PROFILE
    // =========================
    public static CustomerUnifiedProfileResponse toUnifiedProfile(Customer customer) {

        CustomerUnifiedProfileResponse response = new CustomerUnifiedProfileResponse();
        response.setSuccess(true);

        CustomerUnifiedProfileResponse.Profile profile =
                new CustomerUnifiedProfileResponse.Profile();

        profile.setId(customer.getId());
        profile.setName(customer.getFullName());
        profile.setEmail(customer.getEmail());
        profile.setPhone(customer.getPhone());

        profile.setStatus(customer.getStatus());
        profile.setOnboardingStatus(customer.getOnboardingStatus());
        profile.setProfileCompleted(customer.isProfileCompleted());

        profile.setOnboardingComplete(
                "COMPLETED".equalsIgnoreCase(customer.getOnboardingStatus())
        );

        // Wallet (placeholder)
        CustomerUnifiedProfileResponse.Profile.Wallet wallet =
                new CustomerUnifiedProfileResponse.Profile.Wallet();
        wallet.setBalance(0);
        wallet.setCurrency("INR");
        wallet.setStatus("active");

        profile.setWallet(wallet);

        // Addresses
        if (customer.getAddresses() != null) {
            profile.setAddresses(
                    customer.getAddresses().stream()
                            .map(CustomerMapper::toAddressResponse)
                            .toList()
            );
        }

        // Stats
        CustomerUnifiedProfileResponse.Profile.Stats stats =
                new CustomerUnifiedProfileResponse.Profile.Stats();

        stats.setTotalBookings(0);
        stats.setActiveBookings(0);
        stats.setTotalEcommerceOrders(0);
        stats.setWalletBalance(0);

        profile.setStats(stats);

        profile.setBookings(java.util.Collections.emptyList());

        response.setProfile(profile);

        return response;
    }

    // =========================
    // REQUEST → CUSTOMER ENTITY
    // =========================
    public static Customer toCustomer(CreateCustomerRequest request) {
        if (request == null) return null;

        Customer customer = new Customer();

        customer.setPhone(request.getPhone());
        customer.setEmail(request.getEmail());

        String name = request.getFullName() != null
                ? request.getFullName()
                : request.getName();

        customer.setFullName(name);

        customer.setAddress(request.getAddress());
        customer.setCity(request.getCity());
        customer.setState(request.getState());
        customer.setPincode(request.getPincode());

        return customer;
    }

    // =========================
    // REQUEST → PET ENTITY
    // =========================
    public static Pet toPetEntity(AddPetRequest request) {
        if (request == null) return null;

        Pet pet = new Pet();

        pet.setName(request.getName());
        pet.setSpecies(resolveSpecies(request));
        pet.setBreed(request.getBreed());

        if (request.getAgeYears() != null || request.getAgeMonths() != null) {
            pet.setAgeYears(request.getAgeYears());
            pet.setAgeMonths(request.getAgeMonths());
        } else if (request.getAge() != null) {
            if ("months".equalsIgnoreCase(request.getAgeUnit())) {
                pet.setAgeMonths(request.getAge());
            } else {
                pet.setAgeYears(request.getAge());
            }
        }

        pet.setGender(request.getGender());
        pet.setWeightKg(request.getWeightKg() != null ? request.getWeightKg() : request.getWeight());

        pet.setProfilePhotoUrl(request.getPhoto());
        if ((pet.getProfilePhotoUrl() == null || pet.getProfilePhotoUrl().isBlank())
                && request.getPhotos() != null && !request.getPhotos().isEmpty()) {
            pet.setProfilePhotoUrl(request.getPhotos().get(0));
        }
        pet.setMedicalHistory(request.getMedicalHistory());

        return pet;
    }

    // =========================
    // PET → RESPONSE
    // =========================
    public static PetResponse toPetResponse(Pet pet) {
        if (pet == null) return null;

        PetResponse response = new PetResponse();

        response.setId(pet.getId());
        response.setName(pet.getName());

        response.setSpecies(pet.getSpecies());
        response.setType(pet.getSpecies()); // alias

        response.setBreed(pet.getBreed());

        response.setAgeYears(pet.getAgeYears());
        response.setAgeMonths(pet.getAgeMonths());
        if (pet.getAgeYears() != null) {
            response.setAge(pet.getAgeYears());
            response.setAgeUnit("years");
        } else if (pet.getAgeMonths() != null) {
            response.setAge(pet.getAgeMonths());
            response.setAgeUnit("months");
        }

        response.setGender(pet.getGender());
        response.setWeightKg(pet.getWeightKg());
        response.setWeight(pet.getWeightKg());

        String petPhoto = rewriteMediaUrl(pet.getProfilePhotoUrl());
        response.setPhoto(petPhoto);
        response.setPhotos(petPhoto == null ? java.util.List.of() : java.util.List.of(petPhoto));
        response.setMedicalHistory(pet.getMedicalHistory());

        response.setCreatedAt(toString(pet.getCreatedAt()));

        return response;
    }

    // =========================
    // REQUEST → ADDRESS ENTITY
    // =========================
    public static CustomerAddress toAddressEntity(AddressRequest request) {
        if (request == null) return null;

        CustomerAddress address = new CustomerAddress();

        address.setAddressType(request.getLabel());
        address.setFullName(request.getName());
        address.setPhone(request.getPhone());

        address.setAddressLine1(request.getAddressLine1());
        address.setAddressLine2(request.getAddressLine2());

        address.setCity(request.getCity());
        address.setState(request.getState());
        address.setPincode(request.getPincode());

        address.setLandmark(request.getLandmark());
        address.setCoordinates(request.getCoordinates());

        address.setDefault(Boolean.TRUE.equals(request.getIsDefault()));

        address.setFlatNo(request.getFlatNo());
        address.setHouseNo(request.getHouseNo());
        address.setFloor(request.getFloor());
        address.setStreetName(request.getStreetName());
        address.setApartmentName(request.getApartmentName());

        return address;
    }

    // =========================
    // ADDRESS → RESPONSE
    // =========================
    public static AddressResponse toAddressResponse(CustomerAddress address) {
        if (address == null) return null;

        AddressResponse response = new AddressResponse();

        response.setId(address.getId());

        if (address.getCustomer() != null) {
            response.setCustomerId(address.getCustomer().getId());
        }

        response.setLabel(address.getAddressType());
        response.setName(address.getFullName());
        response.setPhone(address.getPhone());

        response.setAddressLine1(address.getAddressLine1());
        response.setAddressLine2(address.getAddressLine2());

        response.setCity(address.getCity());
        response.setState(address.getState());
        response.setPincode(address.getPincode());

        response.setLandmark(address.getLandmark());
        response.setIsDefault(address.isDefault());

        response.setCoordinates(address.getCoordinates());
        if (address.getCoordinates() != null) {
            response.setPlaceId(asString(address.getCoordinates().get("placeId")));
            response.setFormattedAddress(asString(address.getCoordinates().get("formattedAddress")));
            response.setLatitude(asDouble(address.getCoordinates().get("lat")));
            response.setLongitude(asDouble(address.getCoordinates().get("lng")));
        }

        response.setFlatNo(address.getFlatNo());
        response.setHouseNo(address.getHouseNo());
        response.setFloor(address.getFloor());
        response.setStreetName(address.getStreetName());
        response.setApartmentName(address.getApartmentName());

        response.setCreatedAt(toString(address.getCreatedAt()));
        response.setUpdatedAt(toString(address.getUpdatedAt()));

        return response;
    }

    // =========================
    // PREFERENCES → MAP
    // =========================
    public static Map<String, Object> toPreferenceMap(CustomerPreferencesRequest request) {

        Map<String, Object> map = new HashMap<>();

        map.put("journeyType", request.getJourneyType());
        map.put("livingSpace", request.getLivingSpace());
        map.put("lifestyle", request.getLifestyle());
        map.put("budget", request.getBudget());
        map.put("servicePreferences", request.getServicePreferences());
        map.put("hasChildren", request.getHasChildren());
        map.put("hasOtherPets", request.getHasOtherPets());
        map.put("otherPetTypes", request.getOtherPetTypes());

        return map;
    }

    // =========================
    // UTILITY
    // =========================
    private static String toString(Instant instant) {
        return instant != null ? instant.toString() : null;
    }

    private static String resolveSpecies(AddPetRequest request) {
        if (request.getSpecies() != null && !request.getSpecies().isBlank()) return request.getSpecies();
        if (request.getPetType() != null && !request.getPetType().isBlank()) return request.getPetType();
        return request.getType();
    }

    private static String asString(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private static Double asDouble(Object value) {
        if (value instanceof Number number) return number.doubleValue();
        if (value instanceof String text && !text.isBlank()) {
            try {
                return Double.valueOf(text);
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    /**
     * Customer-level granular address fields are stored on the default (or first) CustomerAddress,
     * not on the Customer row. This lets profile reads expose houseNo/floor/etc to the client UIs
     * without forcing them to also fetch /customer/{id}/addresses.
     */
    private static void applyDefaultAddressDetails(
            Customer customer,
            java.util.function.Consumer<String> setAddressLine1,
            java.util.function.Consumer<String> setAddressLine2,
            java.util.function.Consumer<String> setHouseNo,
            java.util.function.Consumer<String> setFlatNo,
            java.util.function.Consumer<String> setFloor,
            java.util.function.Consumer<String> setStreetName,
            java.util.function.Consumer<String> setApartmentName,
            java.util.function.Consumer<String> setLandmark
    ) {
        CustomerAddress source = pickDefaultAddress(customer);
        if (source == null) return;
        setAddressLine1.accept(source.getAddressLine1());
        setAddressLine2.accept(source.getAddressLine2());
        setHouseNo.accept(source.getHouseNo());
        setFlatNo.accept(source.getFlatNo());
        setFloor.accept(source.getFloor());
        setStreetName.accept(source.getStreetName());
        setApartmentName.accept(source.getApartmentName());
        setLandmark.accept(source.getLandmark());
    }

    private static CustomerAddress pickDefaultAddress(Customer customer) {
        if (customer == null || customer.getAddresses() == null || customer.getAddresses().isEmpty()) {
            return null;
        }
        for (CustomerAddress address : customer.getAddresses()) {
            if (address != null && address.isDefault()) {
                return address;
            }
        }
        return customer.getAddresses().get(0);
    }

    private static String[] splitName(String fullName) {
        if (fullName == null || fullName.isBlank()) return new String[]{"", ""};
        String trimmed = fullName.trim();
        int space = trimmed.indexOf(' ');
        if (space < 0) return new String[]{trimmed, ""};
        return new String[]{trimmed.substring(0, space), trimmed.substring(space + 1).trim()};
    }
}