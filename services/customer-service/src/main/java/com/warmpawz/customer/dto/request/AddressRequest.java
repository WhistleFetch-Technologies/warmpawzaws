package com.warmpawz.customer.dto.request;

import lombok.Data;

import java.util.Map;

@Data
public class AddressRequest {

    private String label; // home/work/other

    private String name;
    private String phone;

    private String addressLine1;
    private String addressLine2;

    private String city;
    private String state;
    private String pincode;

    private String landmark;

    private Map<String, Object> coordinates;

    private Boolean isDefault;

    private String flatNo;
    private String houseNo;
    private String floor;
    private String streetName;
    private String apartmentName;
}
