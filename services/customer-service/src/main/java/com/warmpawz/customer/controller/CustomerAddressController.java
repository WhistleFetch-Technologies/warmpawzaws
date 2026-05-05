package com.warmpawz.customer.controller;

import com.warmpawz.customer.dto.common.CommonResponse;
import com.warmpawz.customer.dto.request.AddressRequest;
import com.warmpawz.customer.dto.response.AddressResponse;
import com.warmpawz.customer.service.CustomerAddressService;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/customers")
@RequiredArgsConstructor
@Tag(name = "Customer Address", description = "Address APIs")
public class CustomerAddressController {

    private final CustomerAddressService addressService;

    // =========================
    // CREATE ADDRESS
    // =========================
    @PostMapping("/{customerId}/addresses")
    public CommonResponse<AddressResponse> createAddress(
            @PathVariable UUID customerId,
            @RequestBody AddressRequest request
    ) {
        AddressResponse response = addressService.createAddress(customerId, request);

        return CommonResponse.success(response, "Address created successfully");
    }

    // =========================
    // GET ADDRESSES
    // =========================
    @GetMapping("/{customerId}/addresses")
    public CommonResponse<List<AddressResponse>> getAddresses(
            @PathVariable UUID customerId
    ) {
        List<AddressResponse> response = addressService.getAddresses(customerId);

        return CommonResponse.success(response, "Addresses fetched successfully");
    }

    // =========================
    // UPDATE ADDRESS
    // =========================
    @PutMapping("/addresses/{addressId}")
    public CommonResponse<AddressResponse> updateAddress(
            @PathVariable UUID addressId,
            @RequestBody AddressRequest request
    ) {
        AddressResponse response = addressService.updateAddress(addressId, request);

        return CommonResponse.success(response, "Address updated successfully");
    }

    // =========================
    // DELETE ADDRESS
    // =========================
    @DeleteMapping("/addresses/{addressId}")
    public CommonResponse<Void> deleteAddress(
            @PathVariable UUID addressId
    ) {
        addressService.deleteAddress(addressId);

        return CommonResponse.message("Address deleted successfully");
    }
}