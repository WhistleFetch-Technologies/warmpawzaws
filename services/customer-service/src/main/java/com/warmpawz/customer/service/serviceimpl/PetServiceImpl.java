package com.warmpawz.customer.service.serviceimpl;

import com.warmpawz.customer.dto.request.AddPetRequest;
import com.warmpawz.customer.dto.response.PetResponse;
import com.warmpawz.customer.entity.Customer;
import com.warmpawz.customer.entity.Pet;
import com.warmpawz.customer.mapper.CustomerMapper;
import com.warmpawz.customer.repository.CustomerRepository;
import com.warmpawz.customer.repository.PetRepository;
import com.warmpawz.customer.service.CustomerProfileCompletionService;
import com.warmpawz.customer.service.PetService;
import jakarta.persistence.EntityNotFoundException;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PetServiceImpl implements PetService {

    private final PetRepository petRepository;
    private final CustomerRepository customerRepository;
    private final CustomerProfileCompletionService completionService;
    // =========================
    // ADD PET
    // =========================
    @Override
    @Transactional
    public PetResponse addPet(UUID customerId, AddPetRequest request) {

        Customer customer = customerRepository.findById(customerId)
                .orElseThrow(() -> new EntityNotFoundException("Customer not found"));

        Pet pet = CustomerMapper.toPetEntity(request);
        pet.setCustomer(customer);

        pet.setCreatedAt(Instant.now());
        pet.setUpdatedAt(Instant.now());

        petRepository.save(pet);
        completionService.markPetCompleted(customerId);
        return CustomerMapper.toPetResponse(pet);
    }

    // =========================
    // GET PETS
    // =========================
    @Override
    public List<PetResponse> getPets(UUID customerId) {

        List<Pet> pets = petRepository.findByCustomer_Id(customerId);

        return pets.stream()
                .map(CustomerMapper::toPetResponse)
                .toList();
    }

    // =========================
    // UPDATE PET
    // =========================
    @Override
    @Transactional
    public PetResponse updatePet(UUID petId, AddPetRequest request) {

        Pet pet = petRepository.findById(petId)
                .orElseThrow(() -> new EntityNotFoundException("Pet not found"));

        // Dirty checking updates
        pet.setName(request.getName());
        pet.setSpecies(request.getSpecies());
        pet.setBreed(request.getBreed());

        pet.setAgeYears(request.getAgeYears());
        pet.setAgeMonths(request.getAgeMonths());

        pet.setGender(request.getGender());
        pet.setWeightKg(request.getWeightKg());

        pet.setProfilePhotoUrl(request.getPhoto());
        pet.setMedicalHistory(request.getMedicalHistory());

        pet.setUpdatedAt(Instant.now());

        return CustomerMapper.toPetResponse(pet);
    }

    // =========================
    // DELETE PET
    // =========================
    @Override
    @Transactional
    public void deletePet(UUID petId) {

        Pet pet = petRepository.findById(petId)
                .orElseThrow(() -> new EntityNotFoundException("Pet not found"));

        petRepository.delete(pet);
    }
}