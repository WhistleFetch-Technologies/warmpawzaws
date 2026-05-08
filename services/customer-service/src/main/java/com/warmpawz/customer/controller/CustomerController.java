package com.warmpawz.customer.controller;

import com.warmpawz.customer.dto.common.CommonResponse;
import com.warmpawz.customer.dto.request.CreateCustomerRequest;
import com.warmpawz.customer.dto.request.DeactivateCustomerRequest;
import com.warmpawz.customer.dto.request.UpdateCustomerRequest;
import com.warmpawz.customer.dto.response.CustomerResponse;
import com.warmpawz.customer.exception.BadRequestException;
import com.warmpawz.customer.service.CustomerService;
import com.warmpawz.customer.service.IdempotencyService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping({"/customer", "/customers"})
@RequiredArgsConstructor
@Tag(name = "Customer", description = "Customer APIs")
public class CustomerController {

    private final CustomerService customerService;
    private final IdempotencyService idempotencyService;

    // ================================
    // CREATE CUSTOMER
    // ================================
    @PostMapping({"", "/customers"})
    public ResponseEntity<CommonResponse<CustomerResponse>> createCustomer(@Valid @RequestBody CreateCustomerRequest request) {
        return createCustomer(request, null);
    }

    @PostMapping(path = {"", "/customers"}, headers = "Idempotency-Key")
    public ResponseEntity<CommonResponse<CustomerResponse>> createCustomer(
            @Valid @RequestBody CreateCustomerRequest request,
            @RequestHeader("Idempotency-Key") String idempotencyKey
    ) {
        CommonResponse<CustomerResponse> body = idempotencyService.execute(
                "POST:/customer",
                idempotencyKey,
                request,
                () -> {
                    CustomerResponse response = customerService.createCustomer(request);
                    CommonResponse<CustomerResponse> created = CommonResponse.success(response, "Customer created or already exists");
                    created.setCustomer(response);
                    return created;
                },
                CommonResponse.class
        );
        return ResponseEntity.ok(body);
    }

    @GetMapping("/profile")
    public ResponseEntity<CommonResponse<CustomerResponse>> getProfile(@RequestParam String phone) {
        return profileResponse(requireValidPhone(phone));
    }

    @GetMapping("/profile/unified/{phone}")
    public ResponseEntity<CommonResponse<Map<String, Object>>> getUnifiedProfile(@PathVariable String phone) {
        CustomerResponse response = customerService.getCustomerByPhone(requireValidPhone(phone));
        Map<String, Object> data = Map.of("profile", response);
        CommonResponse<Map<String, Object>> body = CommonResponse.success(data, "Profile fetched successfully");
        body.setProfile(response);
        body.setCustomer(response);
        return ResponseEntity.ok(body);
    }

    @GetMapping("/profile/{identifier}")
    public ResponseEntity<CommonResponse<CustomerResponse>> getProfileByIdentifier(@PathVariable String identifier) {
        return profileResponse(requireValidPhone(identifier));
    }

    @PostMapping("/profile")
    public ResponseEntity<CommonResponse<CustomerResponse>> saveProfile(@RequestBody Map<String, Object> request) {
        String phone = stringValue(request.get("phone"));
        if (phone == null || phone.isBlank()) {
            Object profile = request.get("profile");
            if (profile instanceof Map<?, ?> profileMap) {
                phone = stringValue(profileMap.get("phone"));
            }
        }
        if (phone == null || phone.isBlank()) {
            throw new BadRequestException("phone is required");
        }
        return updateProfileResponse(requireValidPhone(phone), request.get("profile"));
    }

    @PutMapping("/profile/{identifier}")
    public ResponseEntity<CommonResponse<CustomerResponse>> updateProfileByIdentifier(
            @PathVariable String identifier,
            @RequestBody Map<String, Object> request
    ) {
        Object profile = request.get("profile") != null ? request.get("profile") : request;
        return updateProfileResponse(requireValidPhone(identifier), profile);
    }

    // ================================
    // GET CUSTOMER BY ID
    // ================================
    @GetMapping("/{customerId}")
    public ResponseEntity<CommonResponse<CustomerResponse>> getCustomer(@PathVariable UUID customerId) {

        CustomerResponse response = customerService.getCustomerById(customerId);
        CommonResponse<CustomerResponse> body = CommonResponse.success(response);
        body.setCustomer(response);
        return ResponseEntity.ok(body);
    }

    // ================================
    // GET CUSTOMER BY PHONE
    // ================================
    @GetMapping("/by-phone")
    public ResponseEntity<CommonResponse<CustomerResponse>> getCustomerByPhone(@RequestParam String phone) {

        CustomerResponse response = customerService.getCustomerByPhone(requireValidPhone(phone));
        CommonResponse<CustomerResponse> body = CommonResponse.success(response);
        body.setCustomer(response);
        return ResponseEntity.ok(body);
    }

    // ================================
    // UPDATE CUSTOMER
    // ================================
    @PutMapping("/{customerId}")
    public ResponseEntity<CommonResponse<Void>> updateCustomer(
            @PathVariable UUID customerId,
            @Valid @RequestBody UpdateCustomerRequest request
    ) {

        customerService.updateCustomer(customerId, request);
        return ResponseEntity.ok(CommonResponse.message("Customer updated successfully"));
    }

    @DeleteMapping("/{customerId}")
    public ResponseEntity<CommonResponse<Void>> deactivateCustomer(
            @PathVariable UUID customerId,
            @RequestParam(required = false) String reason,
            @RequestBody(required = false) DeactivateCustomerRequest request
    ) {
        if (request != null && request.getReason() != null && !request.getReason().isBlank()) {
            reason = request.getReason();
        }
        customerService.deactivateCustomer(customerId, reason);
        return ResponseEntity.ok(CommonResponse.message("Customer deactivated successfully"));
    }

    private UpdateCustomerRequest toUpdateRequest(Object rawProfile) {
        UpdateCustomerRequest update = new UpdateCustomerRequest();
        if (!(rawProfile instanceof Map<?, ?> profile)) return update;
        update.setFirstName(stringValue(profile.get("firstName")));
        update.setLastName(stringValue(profile.get("lastName")));
        update.setFullName(stringValue(profile.get("fullName")));
        update.setEmail(stringValue(profile.get("email")));
        update.setAddress(stringValue(profile.get("address")));
        update.setCity(stringValue(profile.get("city")));
        update.setState(stringValue(profile.get("state")));
        update.setPincode(stringValue(profile.get("pincode")));
        update.setPhoto(stringValue(profile.get("photo")));
        update.setProfilePhotoUrl(stringValue(profile.get("profilePhotoUrl")));
        return update;
    }

    private ResponseEntity<CommonResponse<CustomerResponse>> profileResponse(String phone) {
        CustomerResponse response = customerService.getCustomerByPhone(phone);
        CommonResponse<CustomerResponse> body = CommonResponse.success(response, "Profile fetched successfully");
        body.setProfile(response);
        body.setCustomer(response);
        return ResponseEntity.ok(body);
    }

    private ResponseEntity<CommonResponse<CustomerResponse>> updateProfileResponse(String phone, Object rawProfile) {
        CustomerResponse customer = customerService.getCustomerByPhone(phone);
        UpdateCustomerRequest update = toUpdateRequest(rawProfile);
        customerService.updateCustomer(customer.getId(), update);
        CustomerResponse response = customerService.getCustomerById(customer.getId());
        CommonResponse<CustomerResponse> body = CommonResponse.success(response, "Profile updated successfully");
        body.setProfile(response);
        body.setCustomer(response);
        return ResponseEntity.ok(body);
    }

    private String stringValue(Object value) {
        return value == null ? null : String.valueOf(value);
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
