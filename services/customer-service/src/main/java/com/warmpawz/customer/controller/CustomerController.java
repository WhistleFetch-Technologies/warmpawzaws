package com.warmpawz.customer.controller;

import com.warmpawz.customer.dto.request.CreateCustomerRequest;
import com.warmpawz.customer.dto.request.UpdateCustomerRequest;
import com.warmpawz.customer.dto.response.CustomerResponse;
import com.warmpawz.customer.service.CustomerService;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/customer")
@RequiredArgsConstructor
@Tag(name = "Customer", description = "Customer APIs")
public class CustomerController {

    private final CustomerService customerService;

    // ================================
    // CREATE CUSTOMER
    // ================================
    @PostMapping("/customers")
    public ResponseEntity<?> createCustomer(@RequestBody CreateCustomerRequest request) {

        CustomerResponse response = customerService.createCustomer(request);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "data", Map.of("customer", response),
                "message", "Customer created or already exists"
        ));
    }

    // ================================
    // GET CUSTOMER BY ID
    // ================================
    @GetMapping("/{customerId}")
    public ResponseEntity<?> getCustomer(@PathVariable UUID customerId) {

        CustomerResponse response = customerService.getCustomerById(customerId);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "data", Map.of("customer", response)
        ));
    }

    // ================================
    // GET CUSTOMER BY PHONE
    // ================================
    @GetMapping("/by-phone")
    public ResponseEntity<?> getCustomerByPhone(@RequestParam String phone) {

        CustomerResponse response = customerService.getCustomerByPhone(phone);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "data", Map.of("customer", response)
        ));
    }

    // ================================
    // UPDATE CUSTOMER
    // ================================
    @PutMapping("/{customerId}")
    public ResponseEntity<?> updateCustomer(
            @PathVariable UUID customerId,
            @RequestBody UpdateCustomerRequest request
    ) {

        customerService.updateCustomer(customerId, request);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "data", Map.of(
                        "message", "Customer updated successfully"
                )
        ));
    }
}
