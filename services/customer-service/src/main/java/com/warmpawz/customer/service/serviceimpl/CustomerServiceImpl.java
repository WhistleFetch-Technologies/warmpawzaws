package com.warmpawz.customer.service.serviceimpl;

import com.warmpawz.customer.dto.request.CreateCustomerRequest;
import com.warmpawz.customer.dto.request.UpdateCustomerRequest;
import com.warmpawz.customer.dto.response.CustomerResponse;
import com.warmpawz.customer.config.CacheNames;
import com.warmpawz.customer.entity.Customer;
import com.warmpawz.customer.exception.BadRequestException;
import com.warmpawz.customer.exception.NotFoundException;
import com.warmpawz.customer.mapper.CustomerMapper;
import com.warmpawz.customer.repository.CustomerRepository;
import com.warmpawz.customer.service.CustomerProfileCompletionService;
import com.warmpawz.customer.service.CustomerService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class CustomerServiceImpl implements CustomerService {

    private final CustomerRepository customerRepository;
    private final CustomerProfileCompletionService completionService;
    private final CacheManager cacheManager;
    private final AtomicLong cacheHitCounter = new AtomicLong();
    private final AtomicLong cacheMissCounter = new AtomicLong();

    @Override
    public CustomerResponse createCustomer(CreateCustomerRequest request) {

        if (request.getPhone() == null && request.getEmail() == null) {
            throw new BadRequestException("Phone or Email is required");
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
        invalidateCustomerCaches(saved.getId(), saved.getPhone());

        return saved;
    }

    @Override
    @Transactional(readOnly = true)
    public CustomerResponse getCustomerById(UUID customerId) {
        CustomerResponse cached = getCached(CacheNames.CUSTOMER_BY_ID, customerId.toString(), CustomerResponse.class);
        if (cached != null) return cached;
        Customer customer = customerRepository.findById(customerId)
                .orElseThrow(() -> new NotFoundException("Customer not found"));
        CustomerResponse response = CustomerMapper.toCustomerResponse(customer);
        putCached(CacheNames.CUSTOMER_BY_ID, customerId.toString(), response);
        if (customer.getPhone() != null) {
            putCached(CacheNames.CUSTOMER_BY_PHONE, customer.getPhone(), response);
        }
        return response;
    }

    @Override
    @Transactional(readOnly = true)
    public CustomerResponse getCustomerByPhone(String phone) {
        CustomerResponse cached = getCached(CacheNames.CUSTOMER_BY_PHONE, phone, CustomerResponse.class);
        if (cached != null) return cached;
        Customer customer = customerRepository.findByPhone(phone)
                .orElseThrow(() -> new NotFoundException("Customer not found"));
        CustomerResponse response = CustomerMapper.toCustomerResponse(customer);
        putCached(CacheNames.CUSTOMER_BY_PHONE, phone, response);
        putCached(CacheNames.CUSTOMER_BY_ID, customer.getId().toString(), response);
        return response;
    }

    @Override
    public void updateCustomer(UUID customerId, UpdateCustomerRequest request) {

        Customer customer = customerRepository.findById(customerId)
                .orElseThrow(() -> new NotFoundException("Customer not found"));
        String previousPhone = customer.getPhone();

        String resolvedFullName = request.resolveFullName();
        if (resolvedFullName != null) customer.setFullName(resolvedFullName);
        if (request.getEmail() != null) customer.setEmail(request.getEmail());
        if (request.getDateOfBirth() != null) customer.setDateOfBirth(request.getDateOfBirth());
        if (request.getAddress() != null) customer.setAddress(request.getAddress());
        if (request.getCity() != null) customer.setCity(request.getCity());
        if (request.getState() != null) customer.setState(request.getState());
        if (request.getPincode() != null) customer.setPincode(request.getPincode());
        String resolvedPhoto = request.resolveProfilePhotoUrl();
        if (resolvedPhoto != null) customer.setProfilePhotoUrl(resolvedPhoto);

        // 🔥 ONBOARDING HOOK
        completionService.markBasicInfoCompleted(customerId);
        invalidateCustomerCaches(customerId, previousPhone);
        invalidateCustomerCaches(customerId, customer.getPhone());
    }

    @Override
    public void deactivateCustomer(UUID customerId, String reason) {
        Customer customer = customerRepository.findById(customerId)
                .orElseThrow(() -> new NotFoundException("Customer not found"));
        customer.setActive(false);
        customer.setStatus(Customer.STATUS_INACTIVE);
        invalidateCustomerCaches(customerId, customer.getPhone());
    }

    private <T> T getCached(String cacheName, String key, Class<T> type) {
        Cache cache = cacheManager.getCache(cacheName);
        if (cache == null) return null;
        Cache.ValueWrapper wrapper = cache.get(key);
        if (wrapper == null) {
            long miss = cacheMissCounter.incrementAndGet();
            log.info("event=cache_miss cache={} key={} miss_count={}", cacheName, key, miss);
            return null;
        }
        Object value = wrapper.get();
        if (type.isInstance(value)) {
            long hit = cacheHitCounter.incrementAndGet();
            log.info("event=cache_hit cache={} key={} hit_count={}", cacheName, key, hit);
            return type.cast(value);
        }
        return null;
    }

    private void putCached(String cacheName, String key, Object value) {
        Cache cache = cacheManager.getCache(cacheName);
        if (cache != null && value != null) {
            cache.put(key, value);
        }
    }

    private void invalidateCustomerCaches(UUID customerId, String phone) {
        evict(CacheNames.CUSTOMER_BY_ID, customerId.toString());
        if (phone != null && !phone.isBlank()) {
            evict(CacheNames.CUSTOMER_BY_PHONE, phone);
        }
    }

    private void evict(String cacheName, String key) {
        Cache cache = cacheManager.getCache(cacheName);
        if (cache != null) cache.evict(key);
    }
}