package com.warmpawz.customer.service.serviceimpl;

import com.warmpawz.customer.entity.Customer;
import com.warmpawz.customer.entity.CustomerProfileCompletion;
import com.warmpawz.customer.repository.CustomerProfileCompletionRepository;
import com.warmpawz.customer.repository.CustomerRepository;
import com.warmpawz.customer.service.CustomerProfileCompletionService;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class CustomerProfileCompletionServiceImpl implements CustomerProfileCompletionService {

    private final CustomerProfileCompletionRepository completionRepository;
    private final CustomerRepository customerRepository;
    // =========================
    // GET OR CREATE
    // =========================
    @Override
    public CustomerProfileCompletion getByCustomerId(UUID customerId) {
        return completionRepository.findByCustomerId(customerId)
                .orElseGet(() -> {
                    CustomerProfileCompletion c = new CustomerProfileCompletion();
                    c.setCustomerId(customerId);
                    return completionRepository.save(c);
                });
    }

    // =========================
    // MARK BASIC INFO
    // =========================
    @Override
    public void markBasicInfoCompleted(UUID customerId) {
        CustomerProfileCompletion c = getByCustomerId(customerId);
        c.setBasicInfoCompleted(true);
        checkAndComplete(customerId, c);
    }

    // =========================
    // MARK ADDRESS
    // =========================
    @Override
    public void markAddressCompleted(UUID customerId) {
        CustomerProfileCompletion c = getByCustomerId(customerId);
        c.setAddressCompleted(true);
        checkAndComplete(customerId, c);
    }

    // =========================
    // MARK PET
    // =========================
    @Override
    public void markPetCompleted(UUID customerId) {
        CustomerProfileCompletion c = getByCustomerId(customerId);
        c.setPetProfileCompleted(true);
        checkAndComplete(customerId, c);
    }

    // =========================
    // MARK PREFERENCES
    // =========================
    @Override
    public void markPreferencesCompleted(UUID customerId) {
        CustomerProfileCompletion c = getByCustomerId(customerId);
        c.setPreferencesCompleted(true);
        checkAndComplete(customerId, c);
    }

    // =========================
    // CORE COMPLETION LOGIC
    // =========================
    private void checkAndComplete(UUID customerId, CustomerProfileCompletion c) {

        if (c.isBasicInfoCompleted()
                && c.isAddressCompleted()
                && c.isPetProfileCompleted()
                && c.isPreferencesCompleted()) {

            c.setProfileComplete(true);
            c.setProfileCompletedAt(Instant.now());

            Customer customer = customerRepository.findById(customerId)
                    .orElseThrow(() -> new EntityNotFoundException("Customer not found"));

            customer.setProfileCompleted(true);
            customer.setProfileCompletedAt(Instant.now());
            customer.setOnboardingStatus("COMPLETED");
            customer.setStatus("active");
        }
    }
}