package com.warmpawz.customer.service;

import com.warmpawz.customer.dto.request.AddPetRequest;
import com.warmpawz.customer.dto.response.PetResponse;

import java.util.List;
import java.util.UUID;

public interface PetService {

    PetResponse addPet(UUID customerId, AddPetRequest request);

    PetResponse addPet(AddPetRequest request);

    List<PetResponse> replacePetsByPhone(String phone, List<AddPetRequest> requests);

    List<PetResponse> getPets(UUID customerId);

    List<PetResponse> getPetsByPhone(String phone);

    PetResponse getPet(UUID petId);

    PetResponse updatePet(UUID petId, AddPetRequest request);

    void deletePet(UUID petId);
}