package com.warmpawz.customer.service;

import com.warmpawz.customer.entity.Customer;
import com.warmpawz.customer.config.CacheNames;
import com.warmpawz.customer.repository.CustomerRepository;
import com.warmpawz.customer.service.serviceimpl.CustomerServiceImpl;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.times;

@ExtendWith(MockitoExtension.class)
class CustomerServiceImplTest {

    @Mock
    private CustomerRepository customerRepository;

    @Mock
    private CustomerProfileCompletionService customerProfileCompletionService;

    @InjectMocks
    private CustomerServiceImpl customerService;

    @Mock
    private CacheManager cacheManager;

    @Mock
    private Cache cache;

    @Test
    void deactivateCustomerSoftDeletesByFlags() {
        UUID customerId = UUID.randomUUID();
        Customer customer = new Customer();
        customer.setId(customerId);
        customer.setActive(true);
        customer.setStatus(Customer.STATUS_ACTIVE);
        when(customerRepository.findById(customerId)).thenReturn(Optional.of(customer));

        customerService.deactivateCustomer(customerId, "user request");

        assertFalse(customer.isActive());
        assertEquals(Customer.STATUS_INACTIVE, customer.getStatus());
        assertNotNull(customer.getDeactivatedAt());
        assertEquals("user request", customer.getDeactivationReason());
    }

    @Test
    void deactivateCustomerAllowsMissingReason() {
        UUID customerId = UUID.randomUUID();
        Customer customer = new Customer();
        customer.setId(customerId);
        customer.setActive(true);
        customer.setStatus(Customer.STATUS_ACTIVE);
        when(customerRepository.findById(customerId)).thenReturn(Optional.of(customer));

        customerService.deactivateCustomer(customerId, " ");

        assertFalse(customer.isActive());
        assertEquals(Customer.STATUS_INACTIVE, customer.getStatus());
        assertNotNull(customer.getDeactivatedAt());
        assertNull(customer.getDeactivationReason());
    }

    @Test
    void getCustomerByIdUsesCacheOnRepeatedReads() {
        UUID customerId = UUID.randomUUID();
        Customer customer = new Customer();
        customer.setId(customerId);
        customer.setPhone("9999999999");
        customer.setFullName("John");
        when(cacheManager.getCache(anyString())).thenReturn(cache);
        when(cache.get(customerId.toString())).thenReturn(null, new Cache.ValueWrapper() {
            @Override
            public Object get() {
                com.warmpawz.customer.dto.response.CustomerResponse response = new com.warmpawz.customer.dto.response.CustomerResponse();
                response.setId(customerId);
                response.setPhone("9999999999");
                return response;
            }
        });
        when(customerRepository.findById(customerId)).thenReturn(Optional.of(customer));

        customerService.getCustomerById(customerId);
        customerService.getCustomerById(customerId);

        verify(customerRepository).findById(customerId);
    }

    @Test
    void deactivateCustomerEvictsCustomerCaches() {
        UUID customerId = UUID.randomUUID();
        Customer customer = new Customer();
        customer.setId(customerId);
        customer.setPhone("9999999999");
        when(customerRepository.findById(customerId)).thenReturn(Optional.of(customer));
        when(cacheManager.getCache(CacheNames.CUSTOMER_BY_ID)).thenReturn(cache);
        when(cacheManager.getCache(CacheNames.CUSTOMER_BY_PHONE)).thenReturn(cache);

        customerService.deactivateCustomer(customerId, "test");

        verify(cache, times(1)).evict(customerId.toString());
        verify(cache, times(1)).evict("9999999999");
    }
}
