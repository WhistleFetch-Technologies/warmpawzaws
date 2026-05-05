package com.warmpawz.customer.service.serviceimpl;

import com.warmpawz.customer.dto.request.CreateCustomerRequest;
import com.warmpawz.customer.dto.request.UpdateCustomerRequest;
import com.warmpawz.customer.dto.response.CustomerResponse;
import com.warmpawz.customer.entity.Customer;
import com.warmpawz.customer.mapper.CustomerMapper;
import com.warmpawz.customer.repository.CustomerRepository;
import com.warmpawz.customer.service.CustomerProfileCompletionService;
import com.warmpawz.customer.service.CustomerService;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class CustomerServiceImpl implements CustomerService {

    private final CustomerRepository customerRepository;
    private final CustomerProfileCompletionService completionService; // ✅ ADDED

    @Override
    public CustomerResponse createCustomer(CreateCustomerRequest request) {

        if (request.getPhone() == null && request.getEmail() == null) {
            throw new RuntimeException("Phone or Email is required");
        }

        if (request.getPhone() != null) {
            return customerRepository.findByPhone(request.getPhone())
                    .map(CustomerMapper::toCustomerResponse)
                    .orElseGet(() -> CustomerMapper.toCustomerResponse(createNewCustomer(request)));
        }

        return CustomerMapper.toCustomerResponse(createNewCustomer(request));
    }

    private Customer createNewCustomer(CreateCustomerRequest request) {

        Customer customer = new Customer();

        customer.setPhone(request.getPhone());
        customer.setEmail(request.getEmail());

        String finalName = request.getName() != null
                ? request.getName()
                : request.getFullName();

        if (finalName == null) {
            if (request.getPhone() != null && request.getPhone().length() >= 4) {
                finalName = "Customer " +
                        request.getPhone().substring(request.getPhone().length() - 4);
            } else {
                finalName = "Customer";
            }
        }

        customer.setFullName(finalName);
        customer.setAddress(request.getAddress());
        customer.setCity(request.getCity());
        customer.setState(request.getState());
        customer.setPincode(request.getPincode());

        Customer saved = customerRepository.save(customer);

        // 🔥 ONBOARDING HOOK
        completionService.markBasicInfoCompleted(saved.getId());

        return saved;
    }

    @Override
    @Transactional(readOnly = true)
    public CustomerResponse getCustomerById(UUID customerId) {
        Customer customer = customerRepository.findById(customerId)
                .orElseThrow(() -> new EntityNotFoundException("Customer not found"));
        return CustomerMapper.toCustomerResponse(customer);
    }

    @Override
    @Transactional(readOnly = true)
    public CustomerResponse getCustomerByPhone(String phone) {
        Customer customer = customerRepository.findByPhone(phone)
                .orElseThrow(() -> new EntityNotFoundException("Customer not found"));
        return CustomerMapper.toCustomerResponse(customer);
    }

    @Override
    public void updateCustomer(UUID customerId, UpdateCustomerRequest request) {

        Customer customer = customerRepository.findById(customerId)
                .orElseThrow(() -> new EntityNotFoundException("Customer not found"));

        if (request.getFullName() != null) customer.setFullName(request.getFullName());
        if (request.getEmail() != null) customer.setEmail(request.getEmail());
        if (request.getDateOfBirth() != null) customer.setDateOfBirth(request.getDateOfBirth());
        if (request.getAddress() != null) customer.setAddress(request.getAddress());
        if (request.getCity() != null) customer.setCity(request.getCity());
        if (request.getState() != null) customer.setState(request.getState());
        if (request.getPincode() != null) customer.setPincode(request.getPincode());
        if (request.getProfilePhotoUrl() != null) customer.setProfilePhotoUrl(request.getProfilePhotoUrl());

        // 🔥 ONBOARDING HOOK
        completionService.markBasicInfoCompleted(customerId);
    }
}