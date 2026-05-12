package com.warmpawz.customer.service;

import com.warmpawz.customer.dto.request.AddressRequest;
import com.warmpawz.customer.dto.response.AddressResponse;
import com.warmpawz.customer.dto.common.PaginatedResult;
import com.warmpawz.customer.config.CacheNames;
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
import org.springframework.data.domain.PageImpl;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.times;

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
        verify(cache, times(2)).clear();
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

    @Test
    void getAddressesByPhoneUsesCacheOnRepeatedReads() {
        UUID customerId = UUID.randomUUID();
        Customer customer = customer(customerId);
        CustomerAddress persisted = address(customer, true);

        when(cacheManager.getCache(anyString())).thenReturn(cache);
        when(cache.get("9999999999:p=0:s=10:sort=createdAt,desc")).thenReturn(null, new Cache.ValueWrapper() {
            @Override
            public Object get() {
                AddressResponse addressResponse = new AddressResponse();
                addressResponse.setPhone("9999999999");
                return new PaginatedResult<>(List.of(addressResponse), null);
            }
        });
        when(customerRepository.findByPhone("9999999999")).thenReturn(Optional.of(customer));
        when(addressRepository.findByCustomer_Id(org.mockito.ArgumentMatchers.eq(customerId), any())).thenReturn(new PageImpl<>(List.of(persisted)));

        addressService.getAddressesByPhone("9999999999", 0, 10, "createdAt,desc");
        addressService.getAddressesByPhone("9999999999", 0, 10, "createdAt,desc");

        verify(customerRepository, times(1)).findByPhone("9999999999");
    }

    @Test
    void updateAddressEvictsAddressCaches() {
        UUID customerId = UUID.randomUUID();
        UUID addressId = UUID.randomUUID();
        Customer customer = customer(customerId);
        CustomerAddress address = address(customer, false);
        address.setId(addressId);
        AddressRequest request = new AddressRequest();
        request.setAddressLine1("Updated line");

        when(addressRepository.findById(addressId)).thenReturn(Optional.of(address));
        when(cacheManager.getCache(CacheNames.ADDRESSES_BY_CUSTOMER_ID)).thenReturn(cache);
        when(cacheManager.getCache(CacheNames.ADDRESSES_BY_PHONE)).thenReturn(cache);
        when(googleMapsService.normalize(any(AddressRequest.class))).thenReturn(Optional.empty());

        addressService.updateAddress(customerId, addressId, request);

        verify(cache, times(2)).clear();
    }

    @Test
    void getAddressesUsesPaginationMetadataAndKeys() {
        UUID customerId = UUID.randomUUID();
        Customer customer = customer(customerId);
        CustomerAddress persisted = address(customer, true);
        when(cacheManager.getCache(anyString())).thenReturn(cache);
        when(cache.get(contains(":p=1:s=2:sort=createdAt,asc"))).thenReturn(null);
        when(customerRepository.findById(customerId)).thenReturn(Optional.of(customer));
        when(addressRepository.findByCustomer_Id(org.mockito.ArgumentMatchers.eq(customerId), any()))
                .thenReturn(new PageImpl<>(List.of(persisted), org.springframework.data.domain.PageRequest.of(1, 2), 5));

        PaginatedResult<AddressResponse> result = addressService.getAddresses(customerId, 1, 2, "createdAt,asc");

        assertEquals(1, result.getPagination().getPage());
        assertEquals(2, result.getPagination().getSize());
        assertEquals(5, result.getPagination().getTotalElements());
        assertEquals(3, result.getPagination().getTotalPages());
        assertTrue(result.getPagination().isHasNext());
        verify(cache, times(2)).put(contains(":p=1:s=2:sort=createdAt,asc"), any());
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
