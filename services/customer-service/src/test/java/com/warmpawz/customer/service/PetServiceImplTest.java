package com.warmpawz.customer.service;

import com.warmpawz.customer.dto.request.AddPetRequest;
import com.warmpawz.customer.dto.response.PetResponse;
import com.warmpawz.customer.dto.common.PaginatedResult;
import com.warmpawz.customer.config.CacheNames;
import com.warmpawz.customer.entity.Customer;
import com.warmpawz.customer.entity.Pet;
import com.warmpawz.customer.exception.ConflictException;
import com.warmpawz.customer.repository.CustomerRepository;
import com.warmpawz.customer.repository.PetRepository;
import com.warmpawz.customer.service.serviceimpl.PetServiceImpl;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.times;

@ExtendWith(MockitoExtension.class)
class PetServiceImplTest {

    @Mock
    private PetRepository petRepository;
    @Mock
    private CustomerRepository customerRepository;
    @Mock
    private CustomerProfileCompletionService completionService;
    @Mock
    private CacheManager cacheManager;
    @Mock
    private Cache cache;

    @InjectMocks
    private PetServiceImpl petService;

    @Test
    void duplicatePetReturnsConflict() {
        UUID customerId = UUID.randomUUID();
        Customer customer = new Customer();
        customer.setId(customerId);
        AddPetRequest request = new AddPetRequest();
        request.setName("Milo");
        request.setSpecies("dog");
        request.setBreed("beagle");
        when(customerRepository.findById(customerId)).thenReturn(Optional.of(customer));
        when(petRepository.existsNormalizedDuplicate(customerId, "Milo", "dog", "beagle")).thenReturn(true);

        assertThrows(ConflictException.class, () -> petService.addPet(customerId, request));
    }

    @Test
    void getPetsByPhoneUsesCacheOnRepeatedReads() {
        UUID customerId = UUID.randomUUID();
        Customer customer = new Customer();
        customer.setId(customerId);
        customer.setPhone("9999999999");
        Pet pet = new Pet();
        pet.setName("Milo");
        pet.setCustomer(customer);

        when(cacheManager.getCache(anyString())).thenReturn(cache);
        when(cache.get("9999999999:p=0:s=10:sort=createdAt,desc")).thenReturn(null, new Cache.ValueWrapper() {
            @Override
            public Object get() {
                PetResponse response = new PetResponse();
                response.setName("Milo");
                return new PaginatedResult<>(List.of(response), null);
            }
        });
        when(customerRepository.findByPhone("9999999999")).thenReturn(Optional.of(customer));
        when(petRepository.findByCustomer_Id(org.mockito.ArgumentMatchers.eq(customerId), any()))
                .thenReturn(new PageImpl<>(List.of(pet)));

        petService.getPetsByPhone("9999999999", 0, 10, "createdAt,desc");
        petService.getPetsByPhone("9999999999", 0, 10, "createdAt,desc");

        verify(customerRepository, times(1)).findByPhone("9999999999");
    }

    @Test
    void updatePetEvictsPetCaches() {
        UUID customerId = UUID.randomUUID();
        UUID petId = UUID.randomUUID();
        Customer customer = new Customer();
        customer.setId(customerId);
        customer.setPhone("9999999999");
        Pet pet = new Pet();
        pet.setId(petId);
        pet.setCustomer(customer);
        pet.setUpdatedAt(Instant.now());
        AddPetRequest request = new AddPetRequest();
        request.setName("Updated");

        when(petRepository.findById(petId)).thenReturn(Optional.of(pet));
        when(cacheManager.getCache(CacheNames.PETS_BY_CUSTOMER_ID)).thenReturn(cache);
        when(cacheManager.getCache(CacheNames.PETS_BY_PHONE)).thenReturn(cache);

        petService.updatePet(petId, request);

        verify(cache, times(2)).clear();
    }

    @Test
    void getPetsSupportsExplicitPageSizeSortAndMetadata() {
        UUID customerId = UUID.randomUUID();
        Customer customer = new Customer();
        customer.setId(customerId);
        customer.setPhone("9999999999");
        Pet pet = new Pet();
        pet.setName("Milo");
        pet.setCustomer(customer);
        when(cacheManager.getCache(anyString())).thenReturn(cache);
        when(cache.get(contains(":p=0:s=2:sort=createdAt,asc"))).thenReturn(null);
        when(customerRepository.findById(customerId)).thenReturn(Optional.of(customer));
        when(petRepository.findByCustomer_Id(org.mockito.ArgumentMatchers.eq(customerId), any()))
                .thenReturn(new PageImpl<>(List.of(pet), PageRequest.of(0, 2), 3));

        PaginatedResult<PetResponse> result = petService.getPets(customerId, 0, 2, "createdAt,asc");

        assertEquals(3, result.getPagination().getTotalElements());
        assertEquals(2, result.getPagination().getTotalPages());
        assertTrue(result.getPagination().isHasNext());
        verify(cache, times(2)).put(contains(":p=0:s=2:sort=createdAt,asc"), any());
    }
}
