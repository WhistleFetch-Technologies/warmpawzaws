package com.warmpawz.customer.service.serviceimpl;

import com.warmpawz.customer.dto.common.PaginatedResult;
import com.warmpawz.customer.dto.common.PaginationMetadata;
import com.warmpawz.customer.dto.request.AddressRequest;
import com.warmpawz.customer.dto.response.AddressResponse;
import com.warmpawz.customer.dto.response.GoogleAddressResult;
import com.warmpawz.customer.config.CacheNames;
import com.warmpawz.customer.entity.Customer;
import com.warmpawz.customer.entity.CustomerAddress;
import com.warmpawz.customer.exception.BadRequestException;
import com.warmpawz.customer.exception.ConflictException;
import com.warmpawz.customer.exception.NotFoundException;
import com.warmpawz.customer.mapper.CustomerMapper;
import com.warmpawz.customer.repository.CustomerAddressRepository;
import com.warmpawz.customer.repository.CustomerRepository;
import com.warmpawz.customer.service.CustomerAddressService;
import com.warmpawz.customer.service.GoogleMapsService;
import com.warmpawz.customer.service.CustomerProfileCompletionService;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

@Service
@RequiredArgsConstructor
@Slf4j
public class CustomerAddressServiceImpl implements CustomerAddressService {

    private final CustomerAddressRepository addressRepository;
    private final CustomerRepository customerRepository;
    private final CustomerProfileCompletionService completionService;
    private final GoogleMapsService googleMapsService;
    private final CacheManager cacheManager;
    private final AtomicLong cacheHitCounter = new AtomicLong();
    private final AtomicLong cacheMissCounter = new AtomicLong();

    
    @Override
    @Transactional
    public AddressResponse createAddress(UUID customerId, AddressRequest request) {
        Customer customer = customerRepository.findById(customerId)
                .orElseThrow(() -> new NotFoundException("Customer not found"));
        return createAddressForCustomer(customer, request);
    }

    private AddressResponse createAddressForCustomer(Customer customer, AddressRequest request) {
        UUID customerId = customer.getId();

        normalizeAddress(request, true);
        List<CustomerAddress> existingAddresses = addressRepository.findByCustomer_Id(customerId);
        if (addressRepository.existsNormalizedDuplicate(
                customerId,
                request.getAddressLine1(),
                request.getAddressLine2(),
                request.getCity(),
                request.getState(),
                request.getPincode(),
                normalizedLabel(request.getLabel()))) {
            throw new ConflictException("Address already exists for this customer");
        }
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
            if (existingAddresses.isEmpty()) {
                address.setDefault(true);
            }
        }

        try {
            addressRepository.saveAndFlush(address);
        } catch (DataIntegrityViolationException ex) {
            throw new ConflictException("Address already exists for this customer");
        }
        completionService.markAddressCompleted(customerId);
        invalidateAddressCaches(customerId, customer.getPhone());
        return CustomerMapper.toAddressResponse(address);
    }

    @Override
    @Transactional
    public AddressResponse createAddressByPhone(String phone, AddressRequest request) {
        Customer customer = findCustomerByPhone(phone);
        return createAddressForCustomer(customer, request);
    }

    @Override
    public PaginatedResult<AddressResponse> getAddresses(UUID customerId, int page, int size, String sort) {
        Pageable pageable = buildPageable(page, size, sort);
        String cacheKey = paginatedCacheKey(customerId.toString(), pageable);
        PaginatedResult<AddressResponse> cached = getCached(CacheNames.ADDRESSES_BY_CUSTOMER_ID, cacheKey);
        if (cached != null) return cached;
        Customer customer = customerRepository.findById(customerId)
                .orElseThrow(() -> new NotFoundException("Customer not found"));
        PaginatedResult<AddressResponse> resolved = getAddressesForCustomer(customer, pageable);
        putCached(CacheNames.ADDRESSES_BY_CUSTOMER_ID, cacheKey, resolved);
        if (customer.getPhone() != null) {
            putCached(CacheNames.ADDRESSES_BY_PHONE, paginatedCacheKey(customer.getPhone(), pageable), resolved);
        }
        return resolved;
    }

    private PaginatedResult<AddressResponse> getAddressesForCustomer(Customer customer, Pageable pageable) {
        UUID customerId = customer.getId();
        Page<CustomerAddress> addresses = addressRepository.findByCustomer_Id(customerId, pageable);

        if (!addresses.isEmpty()) {
            List<AddressResponse> items = addresses.stream()
                    .map(CustomerMapper::toAddressResponse)
                    .toList();
            return new PaginatedResult<>(items, toPaginationMetadata(addresses));
        }

        if (customer.getAddress() == null && customer.getPincode() == null) {
            return new PaginatedResult<>(List.of(), toPaginationMetadata(addresses));
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

        List<AddressResponse> fallbackList = List.of(fallback);
        Page<AddressResponse> fallbackPage = new PageImpl<>(fallbackList, pageable, fallbackList.size());
        return new PaginatedResult<>(fallbackList, toPaginationMetadata(fallbackPage));
    }

    @Override
    public PaginatedResult<AddressResponse> getAddressesByPhone(String phone, int page, int size, String sort) {
        Pageable pageable = buildPageable(page, size, sort);
        String cacheKey = paginatedCacheKey(phone, pageable);
        PaginatedResult<AddressResponse> cached = getCached(CacheNames.ADDRESSES_BY_PHONE, cacheKey);
        if (cached != null) return cached;
        Customer customer = findCustomerByPhone(phone);
        PaginatedResult<AddressResponse> resolved = getAddressesForCustomer(customer, pageable);
        putCached(CacheNames.ADDRESSES_BY_PHONE, cacheKey, resolved);
        putCached(CacheNames.ADDRESSES_BY_CUSTOMER_ID, paginatedCacheKey(customer.getId().toString(), pageable), resolved);
        return resolved;
    }

    @Override
    public AddressResponse getAddress(UUID addressId) {
        CustomerAddress address = addressRepository.findById(addressId)
                .orElseThrow(() -> new NotFoundException("Address not found"));
        return CustomerMapper.toAddressResponse(address);
    }

    @Override
    @Transactional
    public AddressResponse updateAddress(UUID customerId, UUID addressId, AddressRequest request) {

        CustomerAddress address = addressRepository.findById(addressId)
                .orElseThrow(() -> new NotFoundException("Address not found"));
        if (customerId != null && !address.getCustomer().getId().equals(customerId)) {
            throw new NotFoundException("Address not found for customer");
        }
        UUID effectiveCustomerId = address.getCustomer().getId();
        normalizeAddress(request, false);
        if (request.getLabel() != null) address.setAddressType(request.getLabel());

        if (request.getName() != null) address.setFullName(request.getName());

        if (request.getPhone() != null) address.setPhone(request.getPhone());
        
        if (request.getAddressLine1() != null) address.setAddressLine1(request.getAddressLine1());
        if (request.getAddressLine2() != null) address.setAddressLine2(request.getAddressLine2());
        if (request.getCity() != null) address.setCity(request.getCity());
        if (request.getState() != null) address.setState(request.getState());
        if (request.getPincode() != null) address.setPincode(request.getPincode());
        if (request.getLandmark() != null) address.setLandmark(request.getLandmark());
        if (request.getCoordinates() != null) address.setCoordinates(request.getCoordinates());
        if (request.getFlatNo() != null) address.setFlatNo(request.getFlatNo());
        if (request.getHouseNo() != null) address.setHouseNo(request.getHouseNo());
        if (request.getFloor() != null) address.setFloor(request.getFloor());
        if (request.getStreetName() != null) address.setStreetName(request.getStreetName());
        if (request.getApartmentName() != null) address.setApartmentName(request.getApartmentName());

        address.setUpdatedAt(Instant.now());

        if (Boolean.TRUE.equals(request.getIsDefault())) {

            List<CustomerAddress> defaults =
                    addressRepository.findByCustomer_IdAndIsDefaultTrue(effectiveCustomerId);

            for (CustomerAddress addr : defaults) {
                addr.setDefault(false);
            }

            address.setDefault(true);
        }
        invalidateAddressCaches(effectiveCustomerId, address.getCustomer().getPhone());
        return CustomerMapper.toAddressResponse(address);
    }

    @Override
    @Transactional
    public AddressResponse updateAddressByPhone(String phone, UUID addressId, AddressRequest request) {
        Customer customer = findCustomerByPhone(phone);
        return updateAddress(customer.getId(), addressId, request);
    }

    @Override
    @Transactional
    public void deleteAddress(UUID customerId, UUID addressId) {

        CustomerAddress address = addressRepository.findById(addressId)
                .orElseThrow(() -> new NotFoundException("Address not found"));
        if (customerId != null && !address.getCustomer().getId().equals(customerId)) {
            throw new NotFoundException("Address not found for customer");
        }
        customerId = address.getCustomer().getId();
        boolean wasDefault = address.isDefault();

        addressRepository.delete(address);

        if (wasDefault) {
            List<CustomerAddress> remaining =
                    addressRepository.findByCustomer_Id(customerId);

            if (!remaining.isEmpty()) {
                remaining.get(0).setDefault(true);
            }
        }
        invalidateAddressCaches(customerId, address.getCustomer().getPhone());
    }

    @Override
    @Transactional
    public void deleteAddressByPhone(String phone, UUID addressId) {
        Customer customer = findCustomerByPhone(phone);
        deleteAddress(customer.getId(), addressId);
    }

    private Customer findCustomerByPhone(String phone) {
        return customerRepository.findByPhone(phone)
                .orElseThrow(() -> new NotFoundException("Customer not found"));
    }

    private void normalizeAddress(AddressRequest request, boolean requireCompleteAddress) {
        googleMapsService.normalize(request).ifPresent(result -> applyNormalizedAddress(request, result));
        Map<String, Object> coordinates = request.getCoordinates() == null
                ? new HashMap<>()
                : new HashMap<>(request.getCoordinates());
        putIfPresent(coordinates, "placeId", request.getPlaceId());
        putIfPresent(coordinates, "formattedAddress", request.getFormattedAddress());
        putIfPresent(coordinates, "lat", request.getLatitude());
        putIfPresent(coordinates, "lng", request.getLongitude());
        if (!coordinates.isEmpty()) {
            request.setCoordinates(coordinates);
        }
        if (requireCompleteAddress) {
            requirePersistableAddress(request);
        }
    }

    private void applyNormalizedAddress(AddressRequest request, GoogleAddressResult result) {
        if (result.getAddressLine1() != null) request.setAddressLine1(result.getAddressLine1());
        if (result.getAddressLine2() != null) request.setAddressLine2(result.getAddressLine2());
        if (result.getCity() != null) request.setCity(result.getCity());
        if (result.getState() != null) request.setState(result.getState());
        if (result.getPincode() != null) request.setPincode(result.getPincode());
        if (result.getFormattedAddress() != null) request.setFormattedAddress(result.getFormattedAddress());
        if (result.getPlaceId() != null) request.setPlaceId(result.getPlaceId());
        if (result.getLatitude() != null) request.setLatitude(result.getLatitude());
        if (result.getLongitude() != null) request.setLongitude(result.getLongitude());
    }

    private void putIfPresent(Map<String, Object> target, String key, Object value) {
        if (value != null) target.put(key, value);
    }

    private void requirePersistableAddress(AddressRequest request) {
        if (!hasText(request.getAddressLine1()) || !hasText(request.getCity())
                || !hasText(request.getState()) || !hasText(request.getPincode())) {
            throw new BadRequestException("Address could not be normalized with required fields");
        }
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private String normalizedLabel(String label) {
        return (label == null || label.isBlank()) ? "home" : label.trim();
    }

    @SuppressWarnings("unchecked")
    private PaginatedResult<AddressResponse> getCached(String cacheName, String key) {
        Cache cache = cacheManager.getCache(cacheName);
        if (cache == null) return null;
        Cache.ValueWrapper wrapper = cache.get(key);
        if (wrapper == null) {
            long miss = cacheMissCounter.incrementAndGet();
            log.info("event=cache_miss cache={} key={} miss_count={}", cacheName, key, miss);
            return null;
        }
        long hit = cacheHitCounter.incrementAndGet();
        log.info("event=cache_hit cache={} key={} hit_count={}", cacheName, key, hit);
        return (PaginatedResult<AddressResponse>) wrapper.get();
    }

    private void putCached(String cacheName, String key, PaginatedResult<AddressResponse> value) {
        Cache cache = cacheManager.getCache(cacheName);
        if (cache != null) cache.put(key, value);
    }

    private void invalidateAddressCaches(UUID customerId, String phone) {
        // Safe fallback: clear all paginated entries when owner writes occur.
        clear(CacheNames.ADDRESSES_BY_CUSTOMER_ID);
        clear(CacheNames.ADDRESSES_BY_PHONE);
    }

    private void clear(String cacheName) {
        Cache cache = cacheManager.getCache(cacheName);
        if (cache != null) cache.clear();
    }

    private Pageable buildPageable(int page, int size, String sort) {
        int resolvedPage = Math.max(page, 0);
        int resolvedSize = Math.min(Math.max(size, 1), 50);
        String sortValue = (sort == null || sort.isBlank()) ? "createdAt,desc" : sort;
        String[] sortParts = sortValue.split(",", 2);
        String sortBy = sortParts[0].isBlank() ? "createdAt" : sortParts[0];
        Sort.Direction direction = (sortParts.length > 1 && "asc".equalsIgnoreCase(sortParts[1]))
                ? Sort.Direction.ASC
                : Sort.Direction.DESC;
        return PageRequest.of(resolvedPage, resolvedSize, Sort.by(direction, sortBy));
    }

    private PaginationMetadata toPaginationMetadata(Page<?> page) {
        return new PaginationMetadata(
                page.getNumber(),
                page.getSize(),
                page.getTotalElements(),
                page.getTotalPages(),
                page.hasNext(),
                page.hasPrevious()
        );
    }

    @SuppressWarnings("java:S3457")
    private String paginatedCacheKey(String ownerKey, Pageable pageable) {
        String sort = pageable.getSort().stream()
                .findFirst()
                .map(order -> order.getProperty() + "," + order.getDirection().name().toLowerCase())
                .orElse("createdAt,desc");
        return ownerKey + ":p=" + pageable.getPageNumber() + ":s=" + pageable.getPageSize() + ":sort=" + sort;
    }

}