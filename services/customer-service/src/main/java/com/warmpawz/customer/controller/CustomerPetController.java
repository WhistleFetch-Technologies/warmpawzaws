package com.warmpawz.customer.controller;

import com.warmpawz.customer.dto.common.CommonResponse;
import com.warmpawz.customer.dto.common.PaginatedResult;
import com.warmpawz.customer.dto.request.AddPetRequest;
import com.warmpawz.customer.dto.request.LegacyPetsRequest;
import com.warmpawz.customer.dto.response.PetResponse;
import com.warmpawz.customer.service.IdempotencyService;
import com.warmpawz.customer.service.PetService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping
@RequiredArgsConstructor
@Tag(name = "Customer Pet", description = "Pet APIs")
public class CustomerPetController {

    private final PetService petService;
    private final IdempotencyService idempotencyService;

    // =========================
    // ADD PET
    // =========================
    @PostMapping({"/customer/{customerId}/pets", "/customers/{customerId}/pets"})
    public ResponseEntity<CommonResponse<PetResponse>> addPet(
            @PathVariable UUID customerId,
            @Valid @RequestBody AddPetRequest request
    ) {
        return addPet(customerId, request, null);
    }

    @PostMapping(path = {"/customer/{customerId}/pets", "/customers/{customerId}/pets"}, headers = "Idempotency-Key")
    public ResponseEntity<CommonResponse<PetResponse>> addPet(
            @PathVariable UUID customerId,
            @Valid @RequestBody AddPetRequest request,
            @RequestHeader("Idempotency-Key") String idempotencyKey
    ) {
        CommonResponse<PetResponse> body = idempotencyService.execute(
                "POST:/customer/{customerId}/pets:" + customerId,
                idempotencyKey,
                request,
                () -> {
                    PetResponse response = petService.addPet(customerId, request);
                    CommonResponse<PetResponse> created = CommonResponse.success(response, "Pet added successfully");
                    created.setPet(response);
                    return created;
                },
                CommonResponse.class
        );
        return ResponseEntity.ok(body);
    }

    @PostMapping("/pets")
    public ResponseEntity<CommonResponse<PetResponse>> createPet(
            @Valid @RequestBody AddPetRequest request
    ) {
        return createPet(request, null);
    }

    @PostMapping(path = "/pets", headers = "Idempotency-Key")
    public ResponseEntity<CommonResponse<PetResponse>> createPet(
            @Valid @RequestBody AddPetRequest request,
            @RequestHeader("Idempotency-Key") String idempotencyKey
    ) {
        String owner = request.getCustomerId() != null ? request.getCustomerId().toString() : request.getPhone();
        CommonResponse<PetResponse> body = idempotencyService.execute(
                "POST:/pets:" + owner,
                idempotencyKey,
                request,
                () -> {
                    PetResponse response = petService.addPet(request);
                    CommonResponse<PetResponse> created = CommonResponse.success(response, "Pet added successfully");
                    created.setPet(response);
                    return created;
                },
                CommonResponse.class
        );
        return ResponseEntity.ok(body);
    }

    @PostMapping("/customer/pets")
    public ResponseEntity<CommonResponse<List<PetResponse>>> replacePetsByPhone(
            @RequestBody LegacyPetsRequest request
    ) {
        List<PetResponse> response = petService.replacePetsByPhone(request.getPhone(), request.getPets());
        CommonResponse<List<PetResponse>> body = CommonResponse.success(response, "Pets saved successfully");
        body.setPets(response);
        return ResponseEntity.ok(body);
    }

    // =========================
    // GET PETS
    // =========================
    @GetMapping({"/customer/{customerId}/pets", "/customers/{customerId}/pets"})
    public ResponseEntity<CommonResponse<List<PetResponse>>> getPets(
            @PathVariable UUID customerId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "createdAt,desc") String sort
    ) {
        PaginatedResult<PetResponse> result = petService.getPets(customerId, page, size, sort);
        List<PetResponse> response = result.getItems();
        CommonResponse<List<PetResponse>> body = CommonResponse.success(response, "Pets fetched successfully");
        body.setPets(response);
        body.setPagination(result.getPagination());
        return ResponseEntity.ok(body);
    }

    @GetMapping("/pets/customer/{customerId}")
    public ResponseEntity<CommonResponse<List<PetResponse>>> getPetsByCustomer(
            @PathVariable UUID customerId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "createdAt,desc") String sort
    ) {
        PaginatedResult<PetResponse> result = petService.getPets(customerId, page, size, sort);
        List<PetResponse> response = result.getItems();
        CommonResponse<List<PetResponse>> body = CommonResponse.success(response, "Pets fetched successfully");
        body.setPets(response);
        body.setPagination(result.getPagination());
        return ResponseEntity.ok(body);
    }

    @GetMapping({"/customer/pets/{phone}", "/customer/pets"})
    public ResponseEntity<CommonResponse<List<PetResponse>>> getPetsByPhone(
            @PathVariable(required = false) String phone,
            @RequestParam(required = false, name = "phone") String phoneParam,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "createdAt,desc") String sort
    ) {
        String resolvedPhone = phone != null ? phone : phoneParam;
        PaginatedResult<PetResponse> result = petService.getPetsByPhone(resolvedPhone, page, size, sort);
        List<PetResponse> response = result.getItems();
        CommonResponse<List<PetResponse>> body = CommonResponse.success(response, "Pets fetched successfully");
        body.setPets(response);
        body.setPagination(result.getPagination());
        return ResponseEntity.ok(body);
    }

    @GetMapping("/pets/{petId}")
    public ResponseEntity<CommonResponse<PetResponse>> getPetById(
            @PathVariable UUID petId
    ) {
        PetResponse response = petService.getPet(petId);
        CommonResponse<PetResponse> body = CommonResponse.success(response, "Pet fetched successfully");
        body.setPet(response);
        return ResponseEntity.ok(body);
    }

    // =========================
    // UPDATE PET
    // =========================
    @PutMapping({"/pets/{petId}", "/customers/pets/{petId}"})
    public ResponseEntity<CommonResponse<PetResponse>> updatePet(
            @PathVariable UUID petId,
            @RequestBody AddPetRequest request
    ) {
        PetResponse response = petService.updatePet(petId, request);
        CommonResponse<PetResponse> body = CommonResponse.success(response, "Pet updated successfully");
        body.setPet(response);
        return ResponseEntity.ok(body);
    }

    // =========================
    // DELETE PET
    // =========================
    @DeleteMapping({"/pets/{petId}", "/customers/pets/{petId}"})
    public ResponseEntity<CommonResponse<Void>> deletePet(
            @PathVariable UUID petId
    ) {
        petService.deletePet(petId);
        return ResponseEntity.ok(CommonResponse.message("Pet deleted successfully"));
    }
}