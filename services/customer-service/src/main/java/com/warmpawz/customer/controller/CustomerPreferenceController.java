package com.warmpawz.customer.controller;

import com.warmpawz.customer.dto.common.CommonResponse;
import com.warmpawz.customer.dto.request.CustomerPreferencesRequest;
import com.warmpawz.customer.service.CustomerPreferenceService;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/customers")
@RequiredArgsConstructor
@Tag(name = "Customer Preferences", description = "Preferences APIs")
public class CustomerPreferenceController {

    private final CustomerPreferenceService preferenceService;

    // =========================
    // SAVE / UPDATE PREFERENCES
    // =========================
    @PostMapping("/{customerId}/preferences")
    public CommonResponse<CustomerPreferencesRequest> savePreferences(
            @PathVariable UUID customerId,
            @RequestBody CustomerPreferencesRequest request
    ) {
        CustomerPreferencesRequest response =
                preferenceService.savePreferences(customerId, request);

        return CommonResponse.success(response, "Preferences saved successfully");
    }

    // =========================
    // GET PREFERENCES
    // =========================
    @GetMapping("/{customerId}/preferences")
    public CommonResponse<CustomerPreferencesRequest> getPreferences(
            @PathVariable UUID customerId
    ) {
        CustomerPreferencesRequest response =
                preferenceService.getPreferences(customerId);

        return CommonResponse.success(response, "Preferences fetched successfully");
    }
}