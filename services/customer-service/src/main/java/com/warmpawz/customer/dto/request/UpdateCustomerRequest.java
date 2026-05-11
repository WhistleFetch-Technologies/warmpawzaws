package com.warmpawz.customer.dto.request;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.Data;

import java.time.LocalDate;

@Data
public class UpdateCustomerRequest {

    private String fullName;
    private String firstName;
    private String lastName;

    private String email;

    private LocalDate dateOfBirth;

    private String address;
    private String addressLine1;
    private String addressLine2;
    private String houseNo;
    private String flatNo;
    private String floor;
    private String streetName;
    private String apartmentName;
    private String landmark;
    private String city;
    private String state;
    private String pincode;

    private String profilePhotoUrl;
    private String photo;

    @JsonIgnore
    public boolean hasGranularAddressFields() {
        return hasText(addressLine1)
                || hasText(addressLine2)
                || hasText(houseNo)
                || hasText(flatNo)
                || hasText(floor)
                || hasText(streetName)
                || hasText(apartmentName)
                || hasText(landmark);
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    @JsonIgnore
    public String resolveFullName() {
        if (fullName != null && !fullName.isBlank()) {
            return fullName.trim();
        }
        if ((firstName != null && !firstName.isBlank()) || (lastName != null && !lastName.isBlank())) {
            String resolved = ((firstName == null ? "" : firstName) + " " + (lastName == null ? "" : lastName)).trim();
            return resolved.isBlank() ? null : resolved;
        }
        return null;
    }

    @JsonIgnore
    public String resolveProfilePhotoUrl() {
        if (profilePhotoUrl != null && !profilePhotoUrl.isBlank()) {
            return profilePhotoUrl.trim();
        }
        if (photo != null && !photo.isBlank()) {
            return photo.trim();
        }
        return null;
    }
}