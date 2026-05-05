package com.warmpawz.customer.service;

import com.warmpawz.customer.dto.request.AddressRequest;
import com.warmpawz.customer.dto.response.AddressResponse;

import java.util.List;
import java.util.UUID;

public interface CustomerAddressService {

    AddressResponse createAddress(UUID customerId, AddressRequest request);

    List<AddressResponse> getAddresses(UUID customerId);

    AddressResponse updateAddress(UUID addressId, AddressRequest request);

    void deleteAddress(UUID addressId);
}