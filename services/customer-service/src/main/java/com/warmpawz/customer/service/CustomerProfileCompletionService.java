package com.warmpawz.customer.service;

import com.warmpawz.customer.entity.CustomerProfileCompletion;

import java.util.UUID;

public interface CustomerProfileCompletionService {

    CustomerProfileCompletion getByCustomerId(UUID customerId);

    void markBasicInfoCompleted(UUID customerId);

    void markAddressCompleted(UUID customerId);

    void markPetCompleted(UUID customerId);

    void markPreferencesCompleted(UUID customerId);
}