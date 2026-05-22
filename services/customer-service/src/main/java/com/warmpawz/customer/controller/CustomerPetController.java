package com.warmpawz.customer.controller;

import com.warmpawz.customer.dto.common.CommonResponse;
import com.warmpawz.customer.dto.common.PaginatedResult;
import com.warmpawz.customer.dto.request.AddPetRequest;
import com.warmpawz.customer.dto.request.LegacyPetsRequest;
import com.warmpawz.customer.dto.response.CustomerResponse;
import com.warmpawz.customer.dto.response.PetResponse;
import com.warmpawz.customer.exception.BadRequestException;
import com.warmpawz.customer.service.BookingServiceClient;
import com.warmpawz.customer.service.CustomerService;
import com.warmpawz.customer.service.IdempotencyService;
import com.warmpawz.customer.service.PetService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

@RestController
@RequestMapping
@RequiredArgsConstructor
@Tag(name = "Customer Pet", description = "Pet APIs")
public class CustomerPetController {

    private static final String UUID_PATTERN = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";

    private static final Pattern UUID_SEGMENT = Pattern.compile("^" + UUID_PATTERN + "$");

    private final PetService petService;
    private final IdempotencyService idempotencyService;
    private final BookingServiceClient bookingServiceClient;
    private final CustomerService customerService;

    @Value("${app.booking-service.enabled:false}")
    private boolean bookingServiceEnabled;

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

    @GetMapping({"/customer/pets/{phone:\\d{10,15}}", "/customer/pets"})
    public ResponseEntity<CommonResponse<List<PetResponse>>> getPetsByPhone(
            @PathVariable(required = false) String phone,
            @RequestParam(required = false, name = "phone") String phoneParam,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "createdAt,desc") String sort
    ) {
        String resolvedPhone = phone != null ? phone : phoneParam;
        PaginatedResult<PetResponse> result = petService.getPetsByPhone(requireValidPhone(resolvedPhone), page, size, sort);
        List<PetResponse> response = result.getItems();
        CommonResponse<List<PetResponse>> body = CommonResponse.success(response, "Pets fetched successfully");
        body.setPets(response);
        body.setPagination(result.getPagination());
        return ResponseEntity.ok(body);
    }

    @GetMapping("/customer/pets/{petId:" + UUID_PATTERN + "}")
    public ResponseEntity<CommonResponse<PetResponse>> getCustomerPetById(
            @PathVariable UUID petId
    ) {
        return petResponse(petService.getPet(petId));
    }

    @GetMapping("/pets/{petId}")
    public ResponseEntity<CommonResponse<PetResponse>> getPetById(
            @PathVariable UUID petId
    ) {
        return petResponse(petService.getPet(petId));
    }

    @GetMapping("/customer/{phone}/pets/{petId}")
    public ResponseEntity<CommonResponse<PetResponse>> getPetByPhone(
            @PathVariable String phone,
            @PathVariable UUID petId
    ) {
        return petResponse(petService.getPetByPhone(requireValidPhone(phone), petId));
    }

    // =========================
    // UPDATE PET
    // =========================
    @PutMapping({"/pets/{petId}", "/customers/pets/{petId}"})
    public ResponseEntity<CommonResponse<PetResponse>> updatePet(
            @PathVariable UUID petId,
            @RequestBody AddPetRequest request
    ) {
        return updatedPetResponse(petService.updatePet(petId, request));
    }

    @PutMapping("/customer/{segment}/pets/{petId}")
    public ResponseEntity<CommonResponse<PetResponse>> updatePetByPhoneOrCustomerId(
            @PathVariable String segment,
            @PathVariable UUID petId,
            @RequestBody AddPetRequest request
    ) {
        if (segment != null && UUID_SEGMENT.matcher(segment.trim()).matches()) {
            return updatedPetResponse(
                    petService.updatePetByCustomerId(UUID.fromString(segment.trim()), petId, request));
        }
        return updatedPetResponse(petService.updatePetByPhone(requireValidPhone(segment), petId, request));
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

    @DeleteMapping("/customer/{segment}/pets/{petId}")
    public ResponseEntity<CommonResponse<Void>> deletePetByPhoneOrCustomerId(
            @PathVariable String segment,
            @PathVariable UUID petId
    ) {
        if (segment != null && UUID_SEGMENT.matcher(segment.trim()).matches()) {
            petService.deletePetByCustomerId(UUID.fromString(segment.trim()), petId);
        } else {
            petService.deletePetByPhone(requireValidPhone(segment), petId);
        }
        return ResponseEntity.ok(CommonResponse.message("Pet deleted successfully"));
    }

    @GetMapping("/customer/by-phone/{phone}/pets/{petId}/bookings")
    public ResponseEntity<CommonResponse<Map<String, Object>>> getPetBookingsByPhone(
            @PathVariable String phone,
            @PathVariable UUID petId
    ) {
        String normalizedPhone = requireValidPhone(phone);
        petService.getPetByPhone(normalizedPhone, petId);
        if (!bookingServiceEnabled) {
            Map<String, Object> data = Map.of(
                    "bookings", List.of(),
                    "stats", Map.of(),
                    "message", "booking_service_not_yet_available"
            );
            return ResponseEntity.ok(CommonResponse.success(data));
        }
        CustomerResponse customer = customerService.getCustomerByPhone(normalizedPhone);
        Map<String, Object> data = bookingServiceClient.getPetBookings(customer.getId(), petId);
        return ResponseEntity.ok(CommonResponse.success(data));
    }

    private ResponseEntity<CommonResponse<PetResponse>> petResponse(PetResponse response) {
        CommonResponse<PetResponse> body = CommonResponse.success(response, "Pet fetched successfully");
        body.setPet(response);
        return ResponseEntity.ok(body);
    }

    private ResponseEntity<CommonResponse<PetResponse>> updatedPetResponse(PetResponse response) {
        CommonResponse<PetResponse> body = CommonResponse.success(response, "Pet updated successfully");
        body.setPet(response);
        return ResponseEntity.ok(body);
    }

    private String requireValidPhone(String rawPhone) {
        if (rawPhone == null || rawPhone.isBlank()) {
            throw new BadRequestException("phone is required");
        }
        String normalized = rawPhone.replaceAll("\\D", "");
        if (normalized.length() < 10 || normalized.length() > 15) {
            throw new BadRequestException("phone must be 10-15 digits");
        }
        return normalized;
    }
}