package com.warmpawz.customer.controller;

import com.warmpawz.customer.dto.common.CommonResponse;
import com.warmpawz.customer.dto.common.PaginatedResult;
import com.warmpawz.customer.dto.request.AddressRequest;
import com.warmpawz.customer.dto.response.AddressResponse;
import com.warmpawz.customer.exception.BadRequestException;
import com.warmpawz.customer.service.CustomerAddressService;
import com.warmpawz.customer.service.IdempotencyService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping({"/customer", "/customers"})
@RequiredArgsConstructor
@Tag(name = "Customer Address", description = "Address APIs")
public class CustomerAddressController {

    private final CustomerAddressService addressService;
    private final IdempotencyService idempotencyService;

    // =========================
    // CREATE ADDRESS
    // =========================
    @PostMapping("/{customerId}/addresses")
    public ResponseEntity<CommonResponse<AddressResponse>> createAddress(
            @PathVariable UUID customerId,
            @Valid @RequestBody AddressRequest request
    ) {
        return createAddress(customerId, request, null);
    }

    @PostMapping(path = "/{customerId}/addresses", headers = "Idempotency-Key")
    public ResponseEntity<CommonResponse<AddressResponse>> createAddress(
            @PathVariable UUID customerId,
            @Valid @RequestBody AddressRequest request,
            @RequestHeader("Idempotency-Key") String idempotencyKey
    ) {
        CommonResponse<AddressResponse> body = idempotencyService.execute(
                "POST:/customer/{customerId}/addresses:" + customerId,
                idempotencyKey,
                request,
                () -> addressResponse(addressService.createAddress(customerId, request), "Address created successfully"),
                CommonResponse.class
        );
        return ResponseEntity.ok(body);
    }

    @PostMapping("/addresses")
    public ResponseEntity<CommonResponse<AddressResponse>> createAddressByPhone(
            @RequestParam(required = false) String customerPhone,
            @RequestHeader(value = "X-Customer-Phone", required = false) String customerPhoneHeader,
            @Valid @RequestBody AddressRequest request
    ) {
        return createAddressByPhone(customerPhone, customerPhoneHeader, request, null);
    }

    @PostMapping(path = "/addresses", headers = "Idempotency-Key")
    public ResponseEntity<CommonResponse<AddressResponse>> createAddressByPhone(
            @RequestParam(required = false) String customerPhone,
            @RequestHeader(value = "X-Customer-Phone", required = false) String customerPhoneHeader,
            @Valid @RequestBody AddressRequest request,
            @RequestHeader("Idempotency-Key") String idempotencyKey
    ) {
        String ownerPhone = resolveOwnerPhone(customerPhone, customerPhoneHeader);
        CommonResponse<AddressResponse> body = idempotencyService.execute(
                "POST:/customer/addresses:" + ownerPhone,
                idempotencyKey,
                request,
                () -> {
                    AddressResponse response = addressService.createAddressByPhone(ownerPhone, request);
                    CommonResponse<AddressResponse> created = CommonResponse.success(response, "Address created successfully");
                    created.setAddress(response);
                    return created;
                },
                CommonResponse.class
        );
        return ResponseEntity.ok(body);
    }

    // =========================
    // GET ADDRESSES
    // =========================
    @GetMapping("/{customerId}/addresses")
    public ResponseEntity<CommonResponse<List<AddressResponse>>> getAddresses(
            @PathVariable UUID customerId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "createdAt,desc") String sort
    ) {
        PaginatedResult<AddressResponse> result = addressService.getAddresses(customerId, page, size, sort);
        List<AddressResponse> response = result.getItems();

        CommonResponse<List<AddressResponse>> body = CommonResponse.success(response, "Addresses fetched successfully");
        body.setAddresses(response);
        body.setPagination(result.getPagination());
        return ResponseEntity.ok(body);
    }

    @GetMapping("/addresses")
    public ResponseEntity<CommonResponse<List<AddressResponse>>> getAddressesByPhone(
            @RequestParam String phone,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "createdAt,desc") String sort
    ) {
        PaginatedResult<AddressResponse> result = addressService.getAddressesByPhone(phone, page, size, sort);
        List<AddressResponse> response = result.getItems();
        CommonResponse<List<AddressResponse>> body = CommonResponse.success(response, "Addresses fetched successfully");
        body.setAddresses(response);
        body.setPagination(result.getPagination());
        return ResponseEntity.ok(body);
    }

    @GetMapping("/addresses/{addressId}")
    public ResponseEntity<CommonResponse<AddressResponse>> getAddress(
            @PathVariable UUID addressId
    ) {
        AddressResponse response = addressService.getAddress(addressId);
        CommonResponse<AddressResponse> body = CommonResponse.success(response, "Address fetched successfully");
        body.setAddress(response);
        return ResponseEntity.ok(body);
    }

    // =========================
    // UPDATE ADDRESS
    // =========================
    @PutMapping({"/{customerRef}/addresses/{addressId}", "/addresses/{addressId}"})
    public ResponseEntity<CommonResponse<AddressResponse>> updateAddress(
            @PathVariable(required = false) String customerRef,
            @PathVariable UUID addressId,
            @Valid @RequestBody AddressRequest request
    ) {
        AddressResponse response;
        UUID customerId = tryParseUuid(customerRef);
        if (customerRef == null || customerRef.isBlank() || customerId != null) {
            response = addressService.updateAddress(customerId, addressId, request);
        } else {
            response = addressService.updateAddressByPhone(customerRef, addressId, request);
        }

        return ResponseEntity.ok(addressResponse(response, "Address updated successfully"));
    }

    @PatchMapping({"/{customerRef}/addresses/{addressId}", "/addresses/{addressId}"})
    public ResponseEntity<CommonResponse<AddressResponse>> patchAddress(
            @PathVariable(required = false) String customerRef,
            @PathVariable UUID addressId,
            @Valid @RequestBody AddressRequest request
    ) {
        AddressResponse response;
        UUID customerId = tryParseUuid(customerRef);
        if (customerRef == null || customerRef.isBlank() || customerId != null) {
            response = addressService.updateAddress(customerId, addressId, request);
        } else {
            response = addressService.updateAddressByPhone(customerRef, addressId, request);
        }

        return ResponseEntity.ok(addressResponse(response, "Address updated successfully"));
    }

    // =========================
    // DELETE ADDRESS
    // =========================
    @DeleteMapping({"/{customerRef}/addresses/{addressId}", "/addresses/{addressId}"})
    public ResponseEntity<CommonResponse<Void>> deleteAddress(
            @PathVariable(required = false) String customerRef,
            @PathVariable UUID addressId
    ) {
        UUID customerId = tryParseUuid(customerRef);
        if (customerRef == null || customerRef.isBlank() || customerId != null) {
            addressService.deleteAddress(customerId, addressId);
        } else {
            addressService.deleteAddressByPhone(customerRef, addressId);
        }

        return ResponseEntity.ok(CommonResponse.message("Address deleted successfully"));
    }

    private CommonResponse<AddressResponse> addressResponse(AddressResponse response, String message) {
        CommonResponse<AddressResponse> body = CommonResponse.success(response, message);
        body.setAddress(response);
        return body;
    }

    private String resolveOwnerPhone(String customerPhone, String customerPhoneHeader) {
        if (customerPhone != null && !customerPhone.isBlank()) {
            return customerPhone;
        }
        if (customerPhoneHeader != null && !customerPhoneHeader.isBlank()) {
            return customerPhoneHeader;
        }
        throw new BadRequestException("customerPhone is required");
    }

    private UUID tryParseUuid(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException ignored) {
            return null;
        }
    }
}