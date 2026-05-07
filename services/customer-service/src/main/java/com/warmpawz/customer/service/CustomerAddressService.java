package com.warmpawz.customer.service;

import com.warmpawz.customer.dto.request.AddressRequest;
import com.warmpawz.customer.dto.response.AddressResponse;

import java.util.List;
import java.util.UUID;

public interface CustomerAddressService {

    AddressResponse createAddress(UUID customerId, AddressRequest request);

    AddressResponse createAddressByPhone(String phone, AddressRequest request);

    List<AddressResponse> getAddresses(UUID customerId);

    List<AddressResponse> getAddressesByPhone(String phone);

    AddressResponse getAddress(UUID addressId);

    AddressResponse updateAddress(UUID customerId, UUID addressId, AddressRequest request);

    AddressResponse updateAddressByPhone(String phone, UUID addressId, AddressRequest request);

    void deleteAddress(UUID customerId, UUID addressId);

    void deleteAddressByPhone(String phone, UUID addressId);
}