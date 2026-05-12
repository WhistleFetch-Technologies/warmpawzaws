package com.warmpawz.customer.service.serviceimpl;

import com.warmpawz.customer.dto.common.PaginatedResult;
import com.warmpawz.customer.dto.common.PaginationMetadata;
import com.warmpawz.customer.dto.request.AddPetRequest;
import com.warmpawz.customer.dto.response.PetResponse;
import com.warmpawz.customer.config.CacheNames;
import com.warmpawz.customer.entity.Customer;
import com.warmpawz.customer.entity.Pet;
import com.warmpawz.customer.exception.BadRequestException;
import com.warmpawz.customer.exception.ConflictException;
import com.warmpawz.customer.exception.NotFoundException;
import com.warmpawz.customer.mapper.CustomerMapper;
import com.warmpawz.customer.repository.CustomerRepository;
import com.warmpawz.customer.repository.PetRepository;
import com.warmpawz.customer.service.CustomerProfileCompletionService;
import com.warmpawz.customer.service.PetService;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

@Service
@RequiredArgsConstructor
@Slf4j
public class PetServiceImpl implements PetService {

    private final PetRepository petRepository;
    private final CustomerRepository customerRepository;
    private final CustomerProfileCompletionService completionService;
    private final CacheManager cacheManager;
    private final AtomicLong cacheHitCounter = new AtomicLong();
    private final AtomicLong cacheMissCounter = new AtomicLong();
    // =========================
    // ADD PET
    // =========================
    @Override
    @Transactional
    public PetResponse addPet(UUID customerId, AddPetRequest request) {
        Customer customer = customerRepository.findById(customerId)
                .orElseThrow(() -> new NotFoundException("Customer not found"));
        return addPetForCustomer(customer, request);
    }

    private PetResponse addPetForCustomer(Customer customer, AddPetRequest request) {
        UUID customerId = customer.getId();
        if (petRepository.existsNormalizedDuplicate(
                customerId,
                request.getName(),
                normalizedSpecies(request),
                request.getBreed())) {
            throw new ConflictException("Pet already exists for this customer");
        }
        Pet pet = CustomerMapper.toPetEntity(request);
        pet.setCustomer(customer);

        pet.setCreatedAt(Instant.now());
        pet.setUpdatedAt(Instant.now());

        try {
            petRepository.saveAndFlush(pet);
        } catch (DataIntegrityViolationException ex) {
            throw new ConflictException("Pet already exists for this customer");
        }
        completionService.markPetCompleted(customerId);
        invalidatePetCaches(customerId, customer.getPhone());
        return CustomerMapper.toPetResponse(pet);
    }

    @Override
    @Transactional
    public PetResponse addPet(AddPetRequest request) {
        if (request.getCustomerId() == null && request.getPhone() != null) {
            Customer customer = findCustomerByFlexiblePhone(request.getPhone())
                    .orElseThrow(() -> new NotFoundException("Customer not found"));
            return addPetForCustomer(customer, request);
        }
        if (request.getCustomerId() == null) {
            throw new BadRequestException("customerId is required");
        }
        return addPet(request.getCustomerId(), request);
    }

    @Override
    @Transactional
    public List<PetResponse> replacePetsByPhone(String phone, List<AddPetRequest> requests) {
        Customer customer = findCustomerByFlexiblePhone(phone)
                .orElseThrow(() -> new NotFoundException("Customer not found"));
        List<Pet> existing = petRepository.findByCustomer_Id(customer.getId());
        for (Pet p : existing) {
            petRepository.unlinkBookingsByPetId(p.getId());
        }
        petRepository.deleteAll(existing);
        invalidatePetCaches(customer.getId(), customer.getPhone());
        if (requests == null) return List.of();
        return requests.stream()
                .map(request -> addPetForCustomer(customer, request))
                .toList();
    }

    // =========================
    // GET PETS
    // =========================
    @Override
    public PaginatedResult<PetResponse> getPets(UUID customerId, int page, int size, String sort) {
        Pageable pageable = buildPageable(page, size, sort);
        String cacheKey = paginatedCacheKey(customerId.toString(), pageable);
        PaginatedResult<PetResponse> cached = getCached(CacheNames.PETS_BY_CUSTOMER_ID, cacheKey);
        if (cached != null) return cached;
        Customer customer = customerRepository.findById(customerId)
                .orElseThrow(() -> new NotFoundException("Customer not found"));
        Page<Pet> petPage = petRepository.findByCustomer_Id(customerId, pageable);
        List<PetResponse> response = petPage.stream()
                .map(CustomerMapper::toPetResponse)
                .toList();
        PaginatedResult<PetResponse> result = new PaginatedResult<>(response, toPaginationMetadata(petPage));
        putCached(CacheNames.PETS_BY_CUSTOMER_ID, cacheKey, result);
        if (customer.getPhone() != null) {
            putCached(CacheNames.PETS_BY_PHONE, paginatedCacheKey(customer.getPhone(), pageable), result);
        }
        return result;
    }

    @Override
    public PaginatedResult<PetResponse> getPetsByPhone(String phone, int page, int size, String sort) {
        Pageable pageable = buildPageable(page, size, sort);
        String cacheKey = paginatedCacheKey(phone, pageable);
        PaginatedResult<PetResponse> cached = getCached(CacheNames.PETS_BY_PHONE, cacheKey);
        if (cached != null) return cached;
        Customer customer = findCustomerByFlexiblePhone(phone)
                .orElseThrow(() -> new NotFoundException("Customer not found"));
        Page<Pet> petPage = petRepository.findByCustomer_Id(customer.getId(), pageable);
        List<PetResponse> response = petPage.stream()
                .map(CustomerMapper::toPetResponse)
                .toList();
        PaginatedResult<PetResponse> result = new PaginatedResult<>(response, toPaginationMetadata(petPage));
        putCached(CacheNames.PETS_BY_PHONE, cacheKey, result);
        putCached(CacheNames.PETS_BY_CUSTOMER_ID, paginatedCacheKey(customer.getId().toString(), pageable), result);
        return result;
    }

    @Override
    public PetResponse getPet(UUID petId) {
        Pet pet = petRepository.findById(petId)
                .orElseThrow(() -> new NotFoundException("Pet not found"));
        return CustomerMapper.toPetResponse(pet);
    }

    @Override
    public PetResponse getPetByPhone(String phone, UUID petId) {
        Pet pet = findOwnedPet(phone, petId);
        return CustomerMapper.toPetResponse(pet);
    }

    // =========================
    // UPDATE PET
    // =========================
    @Override
    @Transactional
    public PetResponse updatePet(UUID petId, AddPetRequest request) {

        Pet pet = petRepository.findById(petId)
                .orElseThrow(() -> new NotFoundException("Pet not found"));

        return updatePetEntity(pet, request);
    }

    @Override
    @Transactional
    public PetResponse updatePetByPhone(String phone, UUID petId, AddPetRequest request) {
        Pet pet = findOwnedPet(phone, petId);
        return updatePetEntity(pet, request);
    }

    // =========================
    // DELETE PET
    // =========================
    @Override
    @Transactional
    public void deletePet(UUID petId) {

        Pet pet = petRepository.findById(petId)
                .orElseThrow(() -> new NotFoundException("Pet not found"));

        deletePetEntity(pet, false);
    }

    @Override
    @Transactional
    public void deletePetByPhone(String phone, UUID petId) {
        Pet pet = findOwnedPet(phone, petId);
        deletePetEntity(pet, true);
    }

    @Override
    @Transactional
    public void deletePetByCustomerId(UUID customerId, UUID petId) {
        Customer customer = customerRepository.findById(customerId)
                .orElseThrow(() -> new NotFoundException("Customer not found"));
        Pet pet = petRepository.findByIdAndCustomer_Id(petId, customer.getId())
                .orElseThrow(() -> new NotFoundException("Pet not found"));
        deletePetEntity(pet, true);
    }

    private Pet findOwnedPet(String phone, UUID petId) {
        Customer customer = findCustomerByFlexiblePhone(phone)
                .orElseThrow(() -> new NotFoundException("Customer not found"));
        return petRepository.findByIdAndCustomer_Id(petId, customer.getId())
                .orElseThrow(() -> new NotFoundException("Pet not found"));
    }

    /**
     * Resolve customer by phone when path/query uses a different string than {@code customers.phone}
     * (e.g. national digits vs E.164). Prefer indexed exact lookups, then digit-normalized SQL (PostgreSQL).
     */
    private Optional<Customer> findCustomerByFlexiblePhone(String phone) {
        if (phone == null || phone.isBlank()) {
            return Optional.empty();
        }
        String trimmed = phone.trim();
        Optional<Customer> byTrimmed = customerRepository.findByPhone(trimmed);
        if (byTrimmed.isPresent()) {
            return byTrimmed;
        }
        String digitsOnly = trimmed.replaceAll("\\D", "");
        if (!digitsOnly.isEmpty()) {
            Optional<Customer> byDigits = customerRepository.findByPhone(digitsOnly);
            if (byDigits.isPresent()) {
                return byDigits;
            }
        }
        String digitsParam = digitsOnly.isEmpty() ? trimmed : digitsOnly;
        return customerRepository.findFirstMatchingPhoneInput(trimmed, digitsParam);
    }

    private PetResponse updatePetEntity(Pet pet, AddPetRequest request) {
        // Dirty checking updates
        if (request.getName() != null) pet.setName(request.getName());
        String species = normalizedSpecies(request);
        if (species != null) pet.setSpecies(species);
        if (request.getBreed() != null) pet.setBreed(request.getBreed());
        if (request.getAgeYears() != null || request.getAgeMonths() != null) {
            pet.setAgeYears(request.getAgeYears());
            pet.setAgeMonths(request.getAgeMonths());
        } else if (request.getAge() != null) {
            if ("months".equalsIgnoreCase(request.getAgeUnit())) {
                pet.setAgeMonths(request.getAge());
                pet.setAgeYears(null);
            } else {
                pet.setAgeYears(request.getAge());
                pet.setAgeMonths(null);
            }
        }
        if (request.getGender() != null) pet.setGender(request.getGender());
        if (request.getWeightKg() != null) {
            pet.setWeightKg(request.getWeightKg());
        } else if (request.getWeight() != null) {
            pet.setWeightKg(request.getWeight());
        }
        if (request.getPhoto() != null) {
            pet.setProfilePhotoUrl(request.getPhoto());
        } else if (request.getPhotos() != null && !request.getPhotos().isEmpty()) {
            pet.setProfilePhotoUrl(request.getPhotos().get(0));
        }
        if (request.getMedicalHistory() != null) pet.setMedicalHistory(request.getMedicalHistory());

        pet.setUpdatedAt(Instant.now());
        invalidatePetCaches(pet.getCustomer().getId(), pet.getCustomer().getPhone());

        return CustomerMapper.toPetResponse(pet);
    }

    /**
     * @param phoneScoped when true, match Lambda {@code DELETE /customer/:phone/pets/:petId}:
     *        reject if active bookings exist; then unlink only rows for this customer+pet.
     *        When false, match {@code DELETE /pets/:petId}: unlink all bookings for this pet, then delete.
     */
    private void deletePetEntity(Pet pet, boolean phoneScoped) {
        UUID petId = pet.getId();
        UUID customerId = pet.getCustomer().getId();
        String phone = pet.getCustomer().getPhone();

        if (phoneScoped) {
            long active = petRepository.countActiveBookingsByPetId(petId);
            if (active > 0) {
                throw new BadRequestException(
                        "Cannot delete pet with active bookings",
                        Map.of(
                                "activeBookingsCount", active,
                                "error", "Cannot delete pet with active bookings"
                        )
                );
            }
            petRepository.unlinkBookingsByPetIdForCustomer(petId, customerId);
        } else {
            petRepository.unlinkBookingsByPetId(petId);
        }

        petRepository.delete(pet);
        invalidatePetCaches(customerId, phone);
    }

    private String normalizedSpecies(AddPetRequest request) {
        if (request.getSpecies() != null && !request.getSpecies().isBlank()) return request.getSpecies();
        if (request.getType() != null && !request.getType().isBlank()) return request.getType();
        return request.getPetType();
    }

    @SuppressWarnings("unchecked")
    private PaginatedResult<PetResponse> getCached(String cacheName, String key) {
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
        return (PaginatedResult<PetResponse>) wrapper.get();
    }

    private void putCached(String cacheName, String key, PaginatedResult<PetResponse> value) {
        Cache cache = cacheManager.getCache(cacheName);
        if (cache != null) cache.put(key, value);
    }

    private void invalidatePetCaches(UUID customerId, String phone) {
        // Safe fallback: clear all paginated entries when owner writes occur.
        clear(CacheNames.PETS_BY_CUSTOMER_ID);
        clear(CacheNames.PETS_BY_PHONE);
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

    private String paginatedCacheKey(String ownerKey, Pageable pageable) {
        String sort = pageable.getSort().stream()
                .findFirst()
                .map(order -> order.getProperty() + "," + order.getDirection().name().toLowerCase())
                .orElse("createdAt,desc");
        return ownerKey + ":p=" + pageable.getPageNumber() + ":s=" + pageable.getPageSize() + ":sort=" + sort;
    }
}