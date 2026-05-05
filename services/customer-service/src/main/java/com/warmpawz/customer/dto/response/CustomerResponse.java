package com.warmpawz.customer.dto.response;

import lombok.Data;

import java.util.UUID;

@Data
public class CustomerResponse {

    private UUID id;
    private String phone;
    private String name;
    private String email;

    private String status;
    private String onboardingStatus;
    private Boolean profileCompleted;

    private String createdAt;
}