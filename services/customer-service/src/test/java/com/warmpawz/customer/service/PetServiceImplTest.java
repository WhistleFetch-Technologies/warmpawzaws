package com.warmpawz.customer.service;

import com.warmpawz.customer.dto.request.AddPetRequest;
import com.warmpawz.customer.entity.Customer;
import com.warmpawz.customer.exception.ConflictException;
import com.warmpawz.customer.repository.CustomerRepository;
import com.warmpawz.customer.repository.PetRepository;
import com.warmpawz.customer.service.serviceimpl.PetServiceImpl;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.cache.CacheManager;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

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
}
