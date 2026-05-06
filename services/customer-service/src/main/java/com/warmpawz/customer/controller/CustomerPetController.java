package com.warmpawz.customer.controller;

import com.warmpawz.customer.dto.common.CommonResponse;
import com.warmpawz.customer.dto.request.AddPetRequest;
import com.warmpawz.customer.dto.response.PetResponse;
import com.warmpawz.customer.service.PetService;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/customers")
@RequiredArgsConstructor
@Tag(name = "Customer Pet", description = "Pet APIs")
public class CustomerPetController {

    private final PetService petService;

    // =========================
    // ADD PET
    // =========================
    @PostMapping("/{customerId}/pets")
    public CommonResponse<PetResponse> addPet(
            @PathVariable UUID customerId,
            @RequestBody AddPetRequest request
    ) {
        PetResponse response = petService.addPet(customerId, request);
        return CommonResponse.success(response, "Pet added successfully");
    }

    // =========================
    // GET PETS
    // =========================
    @GetMapping("/{customerId}/pets")
    public CommonResponse<List<PetResponse>> getPets(
            @PathVariable UUID customerId
    ) {
        List<PetResponse> response = petService.getPets(customerId);
        return CommonResponse.success(response, "Pets fetched successfully");
    }

    // =========================
    // UPDATE PET
    // =========================
    @PutMapping("/pets/{petId}")
    public CommonResponse<PetResponse> updatePet(
            @PathVariable UUID petId,
            @RequestBody AddPetRequest request
    ) {
        PetResponse response = petService.updatePet(petId, request);
        return CommonResponse.success(response, "Pet updated successfully");
    }

    // =========================
    // DELETE PET
    // =========================
    @DeleteMapping("/pets/{petId}")
    public CommonResponse<Void> deletePet(
            @PathVariable UUID petId
    ) {
        petService.deletePet(petId);
        return CommonResponse.message("Pet deleted successfully");
    }
}