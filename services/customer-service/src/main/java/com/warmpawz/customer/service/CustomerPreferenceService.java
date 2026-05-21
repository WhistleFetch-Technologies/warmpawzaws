package com.warmpawz.customer.service;

import com.warmpawz.customer.dto.request.CustomerPreferencesRequest;

import java.util.UUID;

public interface CustomerPreferenceService {

    CustomerPreferencesRequest savePreferences(UUID customerId, CustomerPreferencesRequest request);

    CustomerPreferencesRequest getPreferences(UUID customerId);
}