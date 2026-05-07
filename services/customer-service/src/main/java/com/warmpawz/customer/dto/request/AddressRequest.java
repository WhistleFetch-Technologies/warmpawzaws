package com.warmpawz.customer.dto.request;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.Map;

@Data
public class AddressRequest {

    private String label; // home/work/other

    @NotBlank(message = "Name is required")
    private String name;
    @NotBlank(message = "Phone is required")
    private String phone;

    private String addressLine1;
    private String addressLine2;

    private String city;
    private String state;
    private String pincode;

    private String landmark;

    private Map<String, Object> coordinates;
    private String placeId;
    private String formattedAddress;
    private Double latitude;
    private Double longitude;

    private Boolean isDefault;

    private String flatNo;
    private String houseNo;
    private String floor;
    private String streetName;
    private String apartmentName;

    @AssertTrue(message = "Address details, formattedAddress, or placeId are required")
    public boolean hasAddressSource() {
        if (hasText(placeId) || hasText(formattedAddress)) return true;
        return hasText(addressLine1) && hasText(city) && hasText(state) && hasText(pincode);
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
