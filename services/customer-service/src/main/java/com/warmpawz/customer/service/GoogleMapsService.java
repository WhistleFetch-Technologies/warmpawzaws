package com.warmpawz.customer.service;

import com.warmpawz.customer.dto.request.AddressRequest;
import com.warmpawz.customer.dto.response.GoogleAddressResult;

import java.util.Optional;

public interface GoogleMapsService {
    Optional<GoogleAddressResult> normalize(AddressRequest request);
}
