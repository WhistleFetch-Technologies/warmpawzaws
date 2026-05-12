package com.warmpawz.customer.controller;

import com.warmpawz.customer.dto.common.CommonResponse;
import com.warmpawz.customer.dto.request.CustomerPreferencesRequest;
import com.warmpawz.customer.dto.response.CustomerResponse;
import com.warmpawz.customer.exception.BadRequestException;
import com.warmpawz.customer.service.CustomerPreferenceService;
import com.warmpawz.customer.service.CustomerService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequiredArgsConstructor
@Tag(name = "Customer Preferences", description = "Preferences APIs")
public class CustomerPreferenceController {

    private final CustomerPreferenceService preferenceService;
    private final CustomerService customerService;

    // =========================
    // SAVE / UPDATE PREFERENCES
    // =========================
    @PostMapping("/customers/{customerId}/preferences")
    public ResponseEntity<CommonResponse<CustomerPreferencesRequest>> savePreferences(
            @PathVariable UUID customerId,
            @Valid @RequestBody CustomerPreferencesRequest request
    ) {
        return savePreferencesForCustomer(customerId, request);
    }

    // =========================
    // GET PREFERENCES
    // =========================
    @GetMapping("/customers/{customerId}/preferences")
    public ResponseEntity<CommonResponse<CustomerPreferencesRequest>> getPreferences(
            @PathVariable UUID customerId
    ) {
        return getPreferencesForCustomer(customerId);
    }

    @PostMapping("/customer/{phone}/preferences")
    public ResponseEntity<CommonResponse<CustomerPreferencesRequest>> savePreferencesByPhone(
            @PathVariable String phone,
            @Valid @RequestBody CustomerPreferencesRequest request
    ) {
        CustomerResponse customer = customerService.getCustomerByPhone(requireValidPhone(phone));
        return savePreferencesForCustomer(customer.getId(), request);
    }

    @GetMapping("/customer/{phone}/preferences")
    public ResponseEntity<CommonResponse<CustomerPreferencesRequest>> getPreferencesByPhone(
            @PathVariable String phone
    ) {
        CustomerResponse customer = customerService.getCustomerByPhone(requireValidPhone(phone));
        return getPreferencesForCustomer(customer.getId());
    }

    private ResponseEntity<CommonResponse<CustomerPreferencesRequest>> savePreferencesForCustomer(
            UUID customerId,
            CustomerPreferencesRequest request
    ) {
        CustomerPreferencesRequest response =
                preferenceService.savePreferences(customerId, request);

        return ResponseEntity.ok(CommonResponse.success(response, "Preferences saved successfully"));
    }

    private ResponseEntity<CommonResponse<CustomerPreferencesRequest>> getPreferencesForCustomer(UUID customerId) {
        CustomerPreferencesRequest response =
                preferenceService.getPreferences(customerId);

        return ResponseEntity.ok(CommonResponse.success(response, "Preferences fetched successfully"));
    }

    private String requireValidPhone(String rawPhone) {
        if (rawPhone == null || rawPhone.isBlank()) {
            throw new BadRequestException("phone is required");
        }
        String normalized = rawPhone.replaceAll("\\D", "");
        if (normalized.length() < 10 || normalized.length() > 15) {
            throw new BadRequestException("phone must be 10-15 digits");
        }
        return normalized;
    }
}