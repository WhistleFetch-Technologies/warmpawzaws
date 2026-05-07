package com.warmpawz.customer.service;

import com.warmpawz.customer.dto.request.AddressRequest;
import com.warmpawz.customer.dto.response.AddressResponse;
import com.warmpawz.customer.entity.Customer;
import com.warmpawz.customer.entity.CustomerAddress;
import com.warmpawz.customer.exception.ConflictException;
import com.warmpawz.customer.exception.NotFoundException;
import com.warmpawz.customer.repository.CustomerAddressRepository;
import com.warmpawz.customer.repository.CustomerRepository;
import com.warmpawz.customer.service.serviceimpl.CustomerAddressServiceImpl;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CustomerAddressServiceImplTest {

    @Mock
    private CustomerAddressRepository addressRepository;

    @Mock
    private CustomerRepository customerRepository;

    @Mock
    private CustomerProfileCompletionService completionService;

    @Mock
    private GoogleMapsService googleMapsService;

    @Mock
    private CacheManager cacheManager;

    @Mock
    private Cache cache;

    @InjectMocks
    private CustomerAddressServiceImpl addressService;

    @Test
    void createDefaultClearsExistingDefaults() {
        UUID customerId = UUID.randomUUID();
        Customer customer = customer(customerId);
        CustomerAddress existingDefault = address(customer, true);
        existingDefault.setAddressLine1("Older Line");
        AddressRequest request = fullAddress();
        request.setIsDefault(true);
        when(customerRepository.findById(customerId)).thenReturn(Optional.of(customer));
        when(cacheManager.getCache(org.mockito.ArgumentMatchers.anyString())).thenReturn(cache);
        when(addressRepository.findByCustomer_IdAndIsDefaultTrue(customerId)).thenReturn(List.of(existingDefault));
        when(addressRepository.findByCustomer_Id(customerId)).thenReturn(List.of(existingDefault));
        when(googleMapsService.normalize(any(AddressRequest.class))).thenReturn(Optional.empty());

        addressService.createAddress(customerId, request);

        assertTrue(request.getIsDefault());
        org.junit.jupiter.api.Assertions.assertFalse(existingDefault.isDefault());
        verify(addressRepository).saveAndFlush(any(CustomerAddress.class));
    }

    @Test
    void updateDefaultWithoutCustomerPathDerivesCustomerFromAddress() {
        UUID customerId = UUID.randomUUID();
        UUID addressId = UUID.randomUUID();
        Customer customer = customer(customerId);
        CustomerAddress address = address(customer, false);
        address.setId(addressId);
        CustomerAddress existingDefault = address(customer, true);
        AddressRequest request = new AddressRequest();
        request.setIsDefault(true);
        when(addressRepository.findById(addressId)).thenReturn(Optional.of(address));
        when(cacheManager.getCache(org.mockito.ArgumentMatchers.anyString())).thenReturn(cache);
        when(addressRepository.findByCustomer_IdAndIsDefaultTrue(customerId)).thenReturn(List.of(existingDefault));
        when(googleMapsService.normalize(any(AddressRequest.class))).thenReturn(Optional.empty());

        addressService.updateAddress(null, addressId, request);

        org.junit.jupiter.api.Assertions.assertFalse(existingDefault.isDefault());
        assertTrue(address.isDefault());
        verify(addressRepository).findByCustomer_IdAndIsDefaultTrue(customerId);
    }

    @Test
    void deleteDefaultPromotesRemainingAddress() {
        UUID customerId = UUID.randomUUID();
        UUID addressId = UUID.randomUUID();
        Customer customer = customer(customerId);
        CustomerAddress deleted = address(customer, true);
        deleted.setId(addressId);
        CustomerAddress remaining = address(customer, false);
        when(addressRepository.findById(addressId)).thenReturn(Optional.of(deleted));
        when(cacheManager.getCache(org.mockito.ArgumentMatchers.anyString())).thenReturn(cache);
        when(addressRepository.findByCustomer_Id(customerId)).thenReturn(List.of(remaining));

        addressService.deleteAddress(null, addressId);

        assertTrue(remaining.isDefault());
    }

    @Test
    void updateAddressByPhoneResolvesOwnerAndRejectsForeignAddress() {
        UUID ownerId = UUID.randomUUID();
        UUID foreignId = UUID.randomUUID();
        UUID addressId = UUID.randomUUID();
        Customer owner = customer(ownerId);
        owner.setPhone("9999999999");
        Customer foreign = customer(foreignId);
        CustomerAddress foreignAddress = address(foreign, false);
        foreignAddress.setId(addressId);
        AddressRequest request = new AddressRequest();
        request.setName("Jane");
        when(customerRepository.findByPhone("9999999999")).thenReturn(Optional.of(owner));
        when(addressRepository.findById(addressId)).thenReturn(Optional.of(foreignAddress));

        assertThrows(NotFoundException.class, () -> addressService.updateAddressByPhone("9999999999", addressId, request));
    }

    @Test
    void deleteAddressByPhoneResolvesOwnerAndDeletesOwnedAddress() {
        UUID ownerId = UUID.randomUUID();
        UUID addressId = UUID.randomUUID();
        Customer owner = customer(ownerId);
        owner.setPhone("9999999999");
        CustomerAddress ownAddress = address(owner, false);
        ownAddress.setId(addressId);
        when(customerRepository.findByPhone("9999999999")).thenReturn(Optional.of(owner));
        when(cacheManager.getCache(org.mockito.ArgumentMatchers.anyString())).thenReturn(cache);
        when(addressRepository.findById(addressId)).thenReturn(Optional.of(ownAddress));

        addressService.deleteAddressByPhone("9999999999", addressId);

        verify(addressRepository).delete(ownAddress);
    }

    @Test
    void createAddressDuplicatePayloadReturnsConflict() {
        UUID customerId = UUID.randomUUID();
        Customer customer = customer(customerId);
        AddressRequest request = fullAddress();
        when(customerRepository.findById(customerId)).thenReturn(Optional.of(customer));
        when(addressRepository.findByCustomer_Id(customerId)).thenReturn(List.of());
        when(addressRepository.existsNormalizedDuplicate(customerId, "Line 1", null, "Pune", "MH", "411001", "home"))
                .thenReturn(true);
        when(googleMapsService.normalize(any(AddressRequest.class))).thenReturn(Optional.empty());

        assertThrows(ConflictException.class, () -> addressService.createAddress(customerId, request));
        verify(addressRepository, org.mockito.Mockito.never()).saveAndFlush(any(CustomerAddress.class));
    }

    private Customer customer(UUID customerId) {
        Customer customer = new Customer();
        customer.setId(customerId);
        customer.setPhone("9999999999");
        customer.setFullName("Jane Doe");
        return customer;
    }

    private CustomerAddress address(Customer customer, boolean isDefault) {
        CustomerAddress address = new CustomerAddress();
        address.setCustomer(customer);
        address.setFullName("Jane Doe");
        address.setPhone("9999999999");
        address.setAddressLine1("Line 1");
        address.setCity("Pune");
        address.setState("MH");
        address.setPincode("411001");
        address.setDefault(isDefault);
        return address;
    }

    private AddressRequest fullAddress() {
        AddressRequest request = new AddressRequest();
        request.setName("Jane Doe");
        request.setPhone("9999999999");
        request.setAddressLine1("Line 1");
        request.setCity("Pune");
        request.setState("MH");
        request.setPincode("411001");
        return request;
    }
}
