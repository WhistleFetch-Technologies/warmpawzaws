package com.warmpawz.customer.dto.response;

import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
public class CustomerProfileResponse {

    private UUID id;
    private String phone;
    private String name;
    private String email;

    private String address;
    private String city;
    private String state;
    private String pincode;

    private String photo;

    private String status;
    private String onboardingStatus;
    private Boolean profileCompleted;

    private String createdAt;

    private List<PetResponse> pets;
}
