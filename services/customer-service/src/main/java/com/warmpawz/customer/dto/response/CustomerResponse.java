package com.warmpawz.customer.dto.response;

import lombok.Data;

import java.util.UUID;

@Data
public class CustomerResponse {

    private UUID id;
    private String phone;
    private String name;
    private String fullName;
    private String firstName;
    private String lastName;
    private String email;
    private String photo;
    private String profilePhotoUrl;
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

    private String status;
    private String onboardingStatus;
    private Boolean profileCompleted;

    private String createdAt;
}