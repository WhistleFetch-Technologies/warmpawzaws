package com.warmpawz.customer.controller;

import com.warmpawz.customer.dto.common.CommonResponse;
import com.warmpawz.customer.entity.CustomerProfileCompletion;
import com.warmpawz.customer.service.CustomerProfileCompletionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/customers")
@RequiredArgsConstructor
public class CustomerProfileCompletionController {

    private final CustomerProfileCompletionService completionService;

    // =========================
    // GET STATUS
    // =========================
    @GetMapping("/{customerId}/profile-completion")
    public ResponseEntity<CommonResponse<CustomerProfileCompletion>> getCompletion(
            @PathVariable UUID customerId
    ) {
        return ResponseEntity.ok(CommonResponse.success(
                completionService.getByCustomerId(customerId),
                "Profile completion fetched"
        ));
    }

    // =========================
    // MANUAL TRIGGERS (OPTIONAL)
    // =========================

    @PostMapping("/{customerId}/complete/basic")
    public ResponseEntity<CommonResponse<Void>> markBasic(@PathVariable UUID customerId) {
        completionService.markBasicInfoCompleted(customerId);
        return ResponseEntity.ok(CommonResponse.message("Basic info marked complete"));
    }

    @PostMapping("/{customerId}/complete/address")
    public ResponseEntity<CommonResponse<Void>> markAddress(@PathVariable UUID customerId) {
        completionService.markAddressCompleted(customerId);
        return ResponseEntity.ok(CommonResponse.message("Address marked complete"));
    }

    @PostMapping("/{customerId}/complete/pet")
    public ResponseEntity<CommonResponse<Void>> markPet(@PathVariable UUID customerId) {
        completionService.markPetCompleted(customerId);
        return ResponseEntity.ok(CommonResponse.message("Pet marked complete"));
    }

    @PostMapping("/{customerId}/complete/preferences")
    public ResponseEntity<CommonResponse<Void>> markPreferences(@PathVariable UUID customerId) {
        completionService.markPreferencesCompleted(customerId);
        return ResponseEntity.ok(CommonResponse.message("Preferences marked complete"));
    }
}