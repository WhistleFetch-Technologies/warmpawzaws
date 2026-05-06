package com.warmpawz.customer.dto.request;

import lombok.Data;

@Data
public class CreateCustomerRequest {

    private String phone;
    private String email;
    private String name;       // maps to full_name
    private String fullName;   // optional alternative

    private String address;
    private String city;
    private String state;
    private String pincode;
}
