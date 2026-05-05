package com.warmpawz.customer.service.serviceimpl;

import com.warmpawz.customer.dto.request.AddressRequest;
import com.warmpawz.customer.dto.response.AddressResponse;
import com.warmpawz.customer.entity.Customer;
import com.warmpawz.customer.entity.CustomerAddress;
import com.warmpawz.customer.mapper.CustomerMapper;
import com.warmpawz.customer.repository.CustomerAddressRepository;
import com.warmpawz.customer.repository.CustomerRepository;
import com.warmpawz.customer.service.CustomerAddressService;
import com.warmpawz.customer.service.CustomerProfileCompletionService;
import jakarta.persistence.EntityNotFoundException;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CustomerAddressServiceImpl implements CustomerAddressService {

    private final CustomerAddressRepository addressRepository;
    private final CustomerRepository customerRepository;
    private final CustomerProfileCompletionService completionService;
    @Override
    @Transactional
    public AddressResponse createAddress(UUID customerId, AddressRequest request) {

        Customer customer = customerRepository.findById(customerId)
                .orElseThrow(() -> new EntityNotFoundException("Customer not found"));

        CustomerAddress address = CustomerMapper.toAddressEntity(request);
        address.setCustomer(customer);

        address.setCreatedAt(Instant.now());
        address.setUpdatedAt(Instant.now());

        if (Boolean.TRUE.equals(request.getIsDefault())) {

            List<CustomerAddress> defaults =
                    addressRepository.findByCustomer_IdAndIsDefaultTrue(customerId);

            for (CustomerAddress addr : defaults) {
                addr.setDefault(false);
            }

            address.setDefault(true);

        } else {

            List<CustomerAddress> existing =
                    addressRepository.findByCustomer_Id(customerId);

            if (existing.isEmpty()) {
                address.setDefault(true);
            }
        }

        addressRepository.save(address);
        completionService.markAddressCompleted(customerId);
        return CustomerMapper.toAddressResponse(address);
    }

    @Override
    public List<AddressResponse> getAddresses(UUID customerId) {

        List<CustomerAddress> addresses =
                addressRepository.findByCustomer_Id(customerId);

        if (!addresses.isEmpty()) {
            return addresses.stream()
                    .map(CustomerMapper::toAddressResponse)
                    .toList();
        }

        Customer customer = customerRepository.findById(customerId)
                .orElseThrow(() -> new EntityNotFoundException("Customer not found"));

        if (customer.getAddress() == null && customer.getPincode() == null) {
            return List.of();
        }

        AddressResponse fallback = new AddressResponse();

        fallback.setId(null);
        fallback.setCustomerId(customer.getId());

        fallback.setLabel("home");
        fallback.setName(customer.getFullName());
        fallback.setPhone(customer.getPhone());

        fallback.setAddressLine1(customer.getAddress());
        fallback.setCity(customer.getCity());
        fallback.setState(customer.getState());
        fallback.setPincode(customer.getPincode());

        fallback.setIsDefault(true);

        fallback.setCreatedAt(null);
        fallback.setUpdatedAt(null);

        return List.of(fallback);
    }

    @Override
    @Transactional
    public AddressResponse updateAddress(UUID addressId, AddressRequest request) {

        CustomerAddress address = addressRepository.findById(addressId)
                .orElseThrow(() -> new EntityNotFoundException("Address not found"));

        address.setAddressType(request.getLabel());
        address.setFullName(request.getName());
        address.setPhone(request.getPhone());

        address.setAddressLine1(request.getAddressLine1());
        address.setAddressLine2(request.getAddressLine2());

        address.setCity(request.getCity());
        address.setState(request.getState());
        address.setPincode(request.getPincode());

        address.setLandmark(request.getLandmark());
        address.setCoordinates(request.getCoordinates());

        address.setFlatNo(request.getFlatNo());
        address.setHouseNo(request.getHouseNo());
        address.setFloor(request.getFloor());
        address.setStreetName(request.getStreetName());
        address.setApartmentName(request.getApartmentName());

        address.setUpdatedAt(Instant.now());

        UUID customerId = address.getCustomer().getId();

        if (Boolean.TRUE.equals(request.getIsDefault())) {

            List<CustomerAddress> defaults =
                    addressRepository.findByCustomer_IdAndIsDefaultTrue(customerId);

            for (CustomerAddress addr : defaults) {
                addr.setDefault(false);
            }

            address.setDefault(true);
        }

        return CustomerMapper.toAddressResponse(address);
    }

    @Override
    @Transactional
    public void deleteAddress(UUID addressId) {

        CustomerAddress address = addressRepository.findById(addressId)
                .orElseThrow(() -> new EntityNotFoundException("Address not found"));

        UUID customerId = address.getCustomer().getId();
        boolean wasDefault = address.isDefault();

        addressRepository.delete(address);

        if (wasDefault) {
            List<CustomerAddress> remaining =
                    addressRepository.findByCustomer_Id(customerId);

            if (!remaining.isEmpty()) {
                remaining.get(0).setDefault(true);
            }
        }
    }
}