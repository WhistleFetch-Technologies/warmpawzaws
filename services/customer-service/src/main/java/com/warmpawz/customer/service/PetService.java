package com.warmpawz.customer.service;

import com.warmpawz.customer.dto.common.PaginatedResult;
import com.warmpawz.customer.dto.request.AddPetRequest;
import com.warmpawz.customer.dto.response.PetResponse;

import java.util.List;
import java.util.UUID;

public interface PetService {

    PetResponse addPet(UUID customerId, AddPetRequest request);

    PetResponse addPet(AddPetRequest request);

    List<PetResponse> replacePetsByPhone(String phone, List<AddPetRequest> requests);

    PaginatedResult<PetResponse> getPets(UUID customerId, int page, int size, String sort);

    PaginatedResult<PetResponse> getPetsByPhone(String phone, int page, int size, String sort);

    PetResponse getPet(UUID petId);

    PetResponse getPetByPhone(String phone, UUID petId);

    PetResponse updatePet(UUID petId, AddPetRequest request);

    PetResponse updatePetByPhone(String phone, UUID petId, AddPetRequest request);

    void deletePet(UUID petId);

    void deletePetByPhone(String phone, UUID petId);

    /** Same rules as {@link #deletePetByPhone} when the first path segment is the DB customer id (UUID). */
    void deletePetByCustomerId(UUID customerId, UUID petId);
}