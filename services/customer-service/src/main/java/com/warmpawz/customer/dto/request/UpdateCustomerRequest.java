package com.warmpawz.customer.dto.request;

import lombok.Data;

import java.time.LocalDate;

@Data
public class UpdateCustomerRequest {

    private String fullName;

    private String email;

    private LocalDate dateOfBirth;

    private String address;
    private String city;
    private String state;
    private String pincode;

    private String profilePhotoUrl; // ✅ rename from photo
}