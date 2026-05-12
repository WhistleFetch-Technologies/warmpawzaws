package com.warmpawz.customer.service;

import com.warmpawz.customer.dto.request.AddPetRequest;
import com.warmpawz.customer.dto.response.PetResponse;
import com.warmpawz.customer.dto.common.PaginatedResult;
import com.warmpawz.customer.config.CacheNames;
import com.warmpawz.customer.entity.Customer;
import com.warmpawz.customer.entity.Pet;
import com.warmpawz.customer.exception.BadRequestException;
import com.warmpawz.customer.exception.ConflictException;
import com.warmpawz.customer.exception.NotFoundException;
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
import static org.mockito.ArgumentMatchers.eq;
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
    void getPetsByPhoneResolvesWhenStoredPhoneHasDifferentFormatting() {
        UUID customerId = UUID.randomUUID();
        Customer customer = new Customer();
        customer.setId(customerId);
        // Stored value includes trunk digits; path uses national digits only (no country assumption in service code).
        customer.setPhone("+001515151515");
        Pet pet = new Pet();
        pet.setName("PetA");
        pet.setCustomer(customer);

        when(cacheManager.getCache(anyString())).thenReturn(cache);
        when(cache.get(org.mockito.ArgumentMatchers.contains("1515151515"))).thenReturn(null);
        when(customerRepository.findByPhone("1515151515")).thenReturn(Optional.empty());
        when(customerRepository.findFirstMatchingPhoneInput(eq("1515151515"), eq("1515151515")))
                .thenReturn(Optional.of(customer));
        when(petRepository.findByCustomer_Id(org.mockito.ArgumentMatchers.eq(customerId), any()))
                .thenReturn(new PageImpl<>(List.of(pet)));

        PaginatedResult<PetResponse> result = petService.getPetsByPhone("1515151515", 0, 10, "createdAt,desc");

        assertEquals(1, result.getItems().size());
        verify(customerRepository).findFirstMatchingPhoneInput(eq("1515151515"), eq("1515151515"));
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
    void replacePetsByPhoneClearsAllPaginatedPetCaches() {
        UUID customerId = UUID.randomUUID();
        Customer customer = new Customer();
        customer.setId(customerId);
        customer.setPhone("9999999999");
        Pet existing = new Pet();
        existing.setCustomer(customer);
        AddPetRequest request = new AddPetRequest();
        request.setName("Milo");
        request.setSpecies("dog");

        when(customerRepository.findByPhone("9999999999")).thenReturn(Optional.of(customer));
        when(petRepository.findByCustomer_Id(customerId)).thenReturn(List.of(existing));
        when(cacheManager.getCache(CacheNames.PETS_BY_CUSTOMER_ID)).thenReturn(cache);
        when(cacheManager.getCache(CacheNames.PETS_BY_PHONE)).thenReturn(cache);

        petService.replacePetsByPhone("9999999999", List.of(request));

        verify(petRepository).unlinkBookingsByPetId(existing.getId());
        verify(petRepository).deleteAll(List.of(existing));
        verify(cache, times(4)).clear();
    }

    @Test
    void phoneScopedPetLookupEnforcesOwnership() {
        UUID customerId = UUID.randomUUID();
        UUID petId = UUID.randomUUID();
        Customer customer = new Customer();
        customer.setId(customerId);
        customer.setPhone("9999999999");
        Pet pet = new Pet();
        pet.setId(petId);
        pet.setName("Milo");
        pet.setCustomer(customer);
        when(customerRepository.findByPhone("9999999999")).thenReturn(Optional.of(customer));
        when(petRepository.findByIdAndCustomer_Id(petId, customerId)).thenReturn(Optional.of(pet));

        PetResponse response = petService.getPetByPhone("9999999999", petId);

        assertEquals(petId, response.getId());
    }

    @Test
    void phoneScopedPetLookupReturnsNotFoundForWrongOwner() {
        UUID customerId = UUID.randomUUID();
        UUID petId = UUID.randomUUID();
        Customer customer = new Customer();
        customer.setId(customerId);
        customer.setPhone("9999999999");
        when(customerRepository.findByPhone("9999999999")).thenReturn(Optional.of(customer));
        when(petRepository.findByIdAndCustomer_Id(petId, customerId)).thenReturn(Optional.empty());

        assertThrows(NotFoundException.class, () -> petService.getPetByPhone("9999999999", petId));
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

    @Test
    void deletePetByPhoneUnlinksBookingsThenDeletes() {
        UUID customerId = UUID.randomUUID();
        UUID petId = UUID.randomUUID();
        Customer customer = new Customer();
        customer.setId(customerId);
        customer.setPhone("9999999999");
        Pet pet = new Pet();
        pet.setId(petId);
        pet.setCustomer(customer);

        when(customerRepository.findByPhone("9999999999")).thenReturn(Optional.of(customer));
        when(petRepository.findByIdAndCustomer_Id(petId, customerId)).thenReturn(Optional.of(pet));
        when(petRepository.countActiveBookingsByPetId(petId)).thenReturn(0L);
        when(cacheManager.getCache(CacheNames.PETS_BY_CUSTOMER_ID)).thenReturn(cache);
        when(cacheManager.getCache(CacheNames.PETS_BY_PHONE)).thenReturn(cache);

        petService.deletePetByPhone("9999999999", petId);

        verify(petRepository).unlinkBookingsByPetIdForCustomer(petId, customerId);
        verify(petRepository).delete(pet);
        verify(cache, times(2)).clear();
    }

    @Test
    void deletePetByPhoneRejectsWhenActiveBookings() {
        UUID customerId = UUID.randomUUID();
        UUID petId = UUID.randomUUID();
        Customer customer = new Customer();
        customer.setId(customerId);
        customer.setPhone("9999999999");
        Pet pet = new Pet();
        pet.setId(petId);
        pet.setCustomer(customer);

        when(customerRepository.findByPhone("9999999999")).thenReturn(Optional.of(customer));
        when(petRepository.findByIdAndCustomer_Id(petId, customerId)).thenReturn(Optional.of(pet));
        when(petRepository.countActiveBookingsByPetId(petId)).thenReturn(2L);

        assertThrows(BadRequestException.class, () -> petService.deletePetByPhone("9999999999", petId));

        verify(petRepository, times(0)).unlinkBookingsByPetIdForCustomer(any(), any());
        verify(petRepository, times(0)).delete(any());
    }

    @Test
    void deletePetUnlinksAllBookingsThenDeletes() {
        UUID customerId = UUID.randomUUID();
        UUID petId = UUID.randomUUID();
        Customer customer = new Customer();
        customer.setId(customerId);
        customer.setPhone("9999999999");
        Pet pet = new Pet();
        pet.setId(petId);
        pet.setCustomer(customer);

        when(petRepository.findById(petId)).thenReturn(Optional.of(pet));
        when(cacheManager.getCache(CacheNames.PETS_BY_CUSTOMER_ID)).thenReturn(cache);
        when(cacheManager.getCache(CacheNames.PETS_BY_PHONE)).thenReturn(cache);

        petService.deletePet(petId);

        verify(petRepository).unlinkBookingsByPetId(petId);
        verify(petRepository).delete(pet);
    }
}
