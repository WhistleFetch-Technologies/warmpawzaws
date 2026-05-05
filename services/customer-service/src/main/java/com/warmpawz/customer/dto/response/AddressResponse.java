package com.warmpawz.customer.dto.response;

import lombok.Data;

import java.util.Map;
import java.util.UUID;

@Data
public class AddressResponse {

    private UUID id;
    private UUID customerId;

    private String label;

    private String name;
    private String phone;

    private String addressLine1;
    private String addressLine2;

    private String city;
    private String state;
    private String pincode;

    private String landmark;

    private Boolean isDefault;

    private Map<String, Object> coordinates;

    private String flatNo;
    private String houseNo;
    private String floor;
    private String streetName;
    private String apartmentName;

    private String createdAt;
    private String updatedAt;
}
