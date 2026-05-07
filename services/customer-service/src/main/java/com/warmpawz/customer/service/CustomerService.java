package com.warmpawz.customer.service;

import com.warmpawz.customer.dto.request.CreateCustomerRequest;
import com.warmpawz.customer.dto.request.UpdateCustomerRequest;
import com.warmpawz.customer.dto.response.CustomerResponse;

import java.util.UUID;

public interface CustomerService {

    CustomerResponse createCustomer(CreateCustomerRequest request);

    CustomerResponse getCustomerById(UUID customerId);

    CustomerResponse getCustomerByPhone(String phone);

    void updateCustomer(UUID customerId, UpdateCustomerRequest request);
}