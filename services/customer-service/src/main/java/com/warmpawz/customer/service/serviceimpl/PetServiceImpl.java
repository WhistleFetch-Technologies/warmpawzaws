package com.warmpawz.customer.service.serviceimpl;

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
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
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
            Customer customer = customerRepository.findByPhone(request.getPhone())
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
        Customer customer = customerRepository.findByPhone(phone)
                .orElseThrow(() -> new NotFoundException("Customer not found"));
        List<Pet> existing = petRepository.findByCustomer_Id(customer.getId());
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
    public List<PetResponse> getPets(UUID customerId) {
        List<PetResponse> cached = getCached(CacheNames.PETS_BY_CUSTOMER_ID, customerId.toString());
        if (cached != null) return cached;
        Customer customer = customerRepository.findById(customerId)
                .orElseThrow(() -> new NotFoundException("Customer not found"));
        List<PetResponse> response = petRepository.findByCustomer_Id(customerId).stream()
                .map(CustomerMapper::toPetResponse)
                .toList();
        putCached(CacheNames.PETS_BY_CUSTOMER_ID, customerId.toString(), response);
        if (customer.getPhone() != null) putCached(CacheNames.PETS_BY_PHONE, customer.getPhone(), response);
        return response;
    }

    @Override
    public List<PetResponse> getPetsByPhone(String phone) {
        List<PetResponse> cached = getCached(CacheNames.PETS_BY_PHONE, phone);
        if (cached != null) return cached;
        Customer customer = customerRepository.findByPhone(phone)
                .orElseThrow(() -> new NotFoundException("Customer not found"));
        List<PetResponse> response = petRepository.findByCustomer_Id(customer.getId()).stream()
                .map(CustomerMapper::toPetResponse)
                .toList();
        putCached(CacheNames.PETS_BY_PHONE, phone, response);
        putCached(CacheNames.PETS_BY_CUSTOMER_ID, customer.getId().toString(), response);
        return response;
    }

    @Override
    public PetResponse getPet(UUID petId) {
        Pet pet = petRepository.findById(petId)
                .orElseThrow(() -> new NotFoundException("Pet not found"));
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

        // Dirty checking updates
        if (request.getName() != null) pet.setName(request.getName());
        if (request.getSpecies() != null) pet.setSpecies(request.getSpecies());
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

    // =========================
    // DELETE PET
    // =========================
    @Override
    @Transactional
    public void deletePet(UUID petId) {

        Pet pet = petRepository.findById(petId)
                .orElseThrow(() -> new NotFoundException("Pet not found"));

        UUID customerId = pet.getCustomer().getId();
        String phone = pet.getCustomer().getPhone();
        petRepository.delete(pet);
        invalidatePetCaches(customerId, phone);
    }

    private String normalizedSpecies(AddPetRequest request) {
        if (request.getSpecies() != null && !request.getSpecies().isBlank()) return request.getSpecies();
        if (request.getType() != null && !request.getType().isBlank()) return request.getType();
        return request.getPetType();
    }

    @SuppressWarnings("unchecked")
    private List<PetResponse> getCached(String cacheName, String key) {
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
        return (List<PetResponse>) wrapper.get();
    }

    private void putCached(String cacheName, String key, List<PetResponse> value) {
        Cache cache = cacheManager.getCache(cacheName);
        if (cache != null) cache.put(key, value);
    }

    private void invalidatePetCaches(UUID customerId, String phone) {
        evict(CacheNames.PETS_BY_CUSTOMER_ID, customerId.toString());
        if (phone != null && !phone.isBlank()) evict(CacheNames.PETS_BY_PHONE, phone);
    }

    private void evict(String cacheName, String key) {
        Cache cache = cacheManager.getCache(cacheName);
        if (cache != null) cache.evict(key);
    }
}