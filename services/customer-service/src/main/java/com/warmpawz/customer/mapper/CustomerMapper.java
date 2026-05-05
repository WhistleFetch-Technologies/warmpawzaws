package com.warmpawz.customer.mapper;

import com.warmpawz.customer.dto.request.*;
import com.warmpawz.customer.dto.response.*;
import com.warmpawz.customer.entity.*;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

public class CustomerMapper {

    // =========================
    // CUSTOMER → RESPONSE
    // =========================
    public static CustomerResponse toCustomerResponse(Customer customer) {
        if (customer == null) return null;

        CustomerResponse response = new CustomerResponse();
        response.setId(customer.getId());
        response.setPhone(customer.getPhone());
        response.setName(customer.getFullName());
        response.setEmail(customer.getEmail());
        response.setStatus(customer.getStatus());
        response.setOnboardingStatus(customer.getOnboardingStatus());
        response.setProfileCompleted(customer.isProfileCompleted());
        response.setCreatedAt(toString(customer.getCreatedAt()));

        return response;
    }

    // =========================
    // CUSTOMER → PROFILE
    // =========================
    public static CustomerProfileResponse toCustomerProfileResponse(Customer customer) {
        if (customer == null) return null;

        CustomerProfileResponse response = new CustomerProfileResponse();

        response.setId(customer.getId());
        response.setPhone(customer.getPhone());
        response.setName(customer.getFullName());
        response.setEmail(customer.getEmail());

        response.setAddress(customer.getAddress());
        response.setCity(customer.getCity());
        response.setState(customer.getState());
        response.setPincode(customer.getPincode());

        response.setPhoto(customer.getProfilePhotoUrl());

        response.setStatus(customer.getStatus());
        response.setOnboardingStatus(customer.getOnboardingStatus());
        response.setProfileCompleted(customer.isProfileCompleted());

        response.setCreatedAt(toString(customer.getCreatedAt()));

        if (customer.getPets() != null) {
            response.setPets(
                    customer.getPets().stream()
                            .map(CustomerMapper::toPetResponse)
                            .toList()
            );
        }

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
        pet.setSpecies(request.getSpecies());
        pet.setBreed(request.getBreed());

        pet.setAgeYears(request.getAgeYears());
        pet.setAgeMonths(request.getAgeMonths());

        pet.setGender(request.getGender());
        pet.setWeightKg(request.getWeightKg());

        pet.setProfilePhotoUrl(request.getPhoto());
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

        response.setGender(pet.getGender());
        response.setWeightKg(pet.getWeightKg());

        response.setPhoto(pet.getProfilePhotoUrl());
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
}