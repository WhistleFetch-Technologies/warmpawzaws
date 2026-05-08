package com.warmpawz.customer.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.warmpawz.customer.dto.common.CommonResponse;
import com.warmpawz.customer.dto.common.PaginatedResult;
import com.warmpawz.customer.dto.common.PaginationMetadata;
import com.warmpawz.customer.dto.request.AddPetRequest;
import com.warmpawz.customer.dto.request.AddressRequest;
import com.warmpawz.customer.dto.request.CustomerPreferencesRequest;
import com.warmpawz.customer.dto.request.UpdateCustomerRequest;
import com.warmpawz.customer.dto.response.AddressResponse;
import com.warmpawz.customer.dto.response.CustomerResponse;
import com.warmpawz.customer.dto.response.PetResponse;
import com.warmpawz.customer.exception.ApiExceptionHandler;
import com.warmpawz.customer.exception.NotFoundException;
import com.warmpawz.customer.service.CustomerAddressService;
import com.warmpawz.customer.service.CustomerPreferenceService;
import com.warmpawz.customer.service.IdempotencyService;
import com.warmpawz.customer.service.CustomerService;
import com.warmpawz.customer.service.PetService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.UUID;
import java.util.function.Supplier;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.times;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = {CustomerController.class, CustomerAddressController.class, CustomerPetController.class, CustomerPreferenceController.class})
@AutoConfigureMockMvc(addFilters = false)
@Import(ApiExceptionHandler.class)
@org.springframework.test.context.TestPropertySource(properties = {
        "app.security.enabled=false"
})
class CustomerApiCompatibilityControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private CustomerService customerService;

    @MockitoBean
    private CustomerAddressService customerAddressService;

    @MockitoBean
    private CustomerPreferenceService customerPreferenceService;

    @MockitoBean
    private PetService petService;

    @MockitoBean
    private IdempotencyService idempotencyService;

    @BeforeEach
    void setupIdempotencyDefault() {
        when(idempotencyService.execute(anyString(), nullable(String.class), any(), any(Supplier.class), eq(CommonResponse.class)))
                .thenAnswer(invocation -> {
                    Supplier<?> supplier = invocation.getArgument(3);
                    return supplier.get();
                });
    }

    @Test
    void supportsCustomerRoutesWithAliases() throws Exception {
        UUID customerId = UUID.randomUUID();
        CustomerResponse response = new CustomerResponse();
        response.setId(customerId);
        response.setName("John Doe");
        response.setPhoto("photo-url");
        when(customerService.getCustomerById(customerId)).thenReturn(response);
        when(customerService.getCustomerByPhone("9999999999")).thenReturn(response);
        when(customerService.createCustomer(any())).thenReturn(response);

        mockMvc.perform(get("/customer/{customerId}", customerId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.name").value("John Doe"));

        mockMvc.perform(get("/customers/{customerId}", customerId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        mockMvc.perform(get("/customer/by-phone").param("phone", "9999999999"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.customer.id").value(customerId.toString()));

        mockMvc.perform(get("/customer/profile").param("phone", "9999999999"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.profile.id").value(customerId.toString()));

        mockMvc.perform(get("/customer/profile/{identifier}", "9999999999"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.profile.id").value(customerId.toString()));

        mockMvc.perform(post("/customer/customers")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\":\"9999999999\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.customer.id").value(customerId.toString()));

        UpdateCustomerRequest updateRequest = new UpdateCustomerRequest();
        updateRequest.setFirstName("Jane");
        updateRequest.setLastName("Doe");
        updateRequest.setPhoto("new-photo");
        mockMvc.perform(put("/customer/{customerId}", customerId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Customer updated successfully"));

        mockMvc.perform(delete("/customer/{customerId}", customerId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"user request\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Customer deactivated successfully"));
        verify(customerService).deactivateCustomer(eq(customerId), eq("user request"));
    }

    @Test
    void supportsAddressRoutesOldAndNew() throws Exception {
        UUID customerId = UUID.randomUUID();
        UUID addressId = UUID.randomUUID();
        AddressRequest request = new AddressRequest();
        request.setName("Jane");
        request.setPhone("9999999999");
        request.setAddressLine1("line1");
        request.setCity("Pune");
        request.setState("MH");
        request.setPincode("411001");
        AddressResponse response = new AddressResponse();
        response.setId(addressId);
        when(customerAddressService.createAddress(eq(customerId), any(AddressRequest.class))).thenReturn(response);
        when(customerAddressService.createAddressByPhone(eq("9999999999"), any(AddressRequest.class))).thenReturn(response);
        PaginatedResult<AddressResponse> pagedAddressResult =
                new PaginatedResult<>(List.of(response), new PaginationMetadata(0, 10, 1, 1, false, false));
        when(customerAddressService.getAddresses(eq(customerId), anyInt(), anyInt(), anyString())).thenReturn(pagedAddressResult);
        when(customerAddressService.getAddressesByPhone(eq("9999999999"), anyInt(), anyInt(), anyString())).thenReturn(pagedAddressResult);
        when(customerAddressService.getAddress(addressId)).thenReturn(response);
        when(customerAddressService.updateAddress(eq(customerId), eq(addressId), any(AddressRequest.class))).thenReturn(response);
        when(customerAddressService.updateAddress(eq(null), eq(addressId), any(AddressRequest.class))).thenReturn(response);
        when(customerAddressService.updateAddressByPhone(eq("9999999999"), eq(addressId), any(AddressRequest.class))).thenReturn(response);

        mockMvc.perform(post("/customer/{customerId}/addresses", customerId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());
        mockMvc.perform(post("/customer/addresses")
                        .param("customerPhone", "9999999999")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.address.id").value(addressId.toString()));
        mockMvc.perform(post("/customer/addresses")
                        .header("X-Customer-Phone", "9999999999")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Jane\",\"phone\":\"9999999999\",\"placeId\":\"place-123\"}"))
                .andExpect(status().isOk());
        mockMvc.perform(get("/customer/{customerId}/addresses", customerId))
                .andExpect(status().isOk());
        mockMvc.perform(get("/customer/addresses").param("phone", "9999999999"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.addresses[0].id").value(addressId.toString()))
                .andExpect(jsonPath("$.pagination.page").value(0));
        mockMvc.perform(get("/customer/addresses/{addressId}", addressId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.address.id").value(addressId.toString()));
        mockMvc.perform(put("/customer/{customerId}/addresses/{addressId}", customerId, addressId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());
        mockMvc.perform(patch("/customer/{phone}/addresses/{addressId}", "9999999999", addressId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"isDefault\":true}"))
                .andExpect(status().isOk());
        verify(customerAddressService).updateAddressByPhone(eq("9999999999"), eq(addressId), any(AddressRequest.class));
        mockMvc.perform(delete("/customer/{customerId}/addresses/{addressId}", customerId, addressId))
                .andExpect(status().isOk());
    }

    @Test
    void listEndpointsApplyDefaultPaginationWhenParamsMissing() throws Exception {
        UUID customerId = UUID.randomUUID();
        PaginatedResult<AddressResponse> pagedAddressResult =
                new PaginatedResult<>(List.of(), new PaginationMetadata(0, 10, 0, 0, false, false));
        PaginatedResult<PetResponse> pagedPetResult =
                new PaginatedResult<>(List.of(), new PaginationMetadata(0, 10, 0, 0, false, false));
        when(customerAddressService.getAddresses(eq(customerId), eq(0), eq(10), eq("createdAt,desc")))
                .thenReturn(pagedAddressResult);
        when(petService.getPetsByPhone(eq("9999999999"), eq(0), eq(10), eq("createdAt,desc")))
                .thenReturn(pagedPetResult);

        mockMvc.perform(get("/customer/{customerId}/addresses", customerId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pagination.size").value(10));
        mockMvc.perform(get("/customer/pets/{phone}", "9999999999"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pagination.page").value(0));

        verify(customerAddressService, times(1)).getAddresses(eq(customerId), eq(0), eq(10), eq("createdAt,desc"));
        verify(petService, times(1)).getPetsByPhone(eq("9999999999"), eq(0), eq(10), eq("createdAt,desc"));
    }

    @Test
    void listEndpointsSupportExplicitPaginationParams() throws Exception {
        UUID customerId = UUID.randomUUID();
        PaginatedResult<PetResponse> pagedPetResult =
                new PaginatedResult<>(List.of(), new PaginationMetadata(1, 5, 9, 2, false, true));
        when(petService.getPets(eq(customerId), eq(1), eq(5), eq("createdAt,asc")))
                .thenReturn(pagedPetResult);

        mockMvc.perform(get("/pets/customer/{customerId}", customerId)
                        .param("page", "1")
                        .param("size", "5")
                        .param("sort", "createdAt,asc"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pagination.totalPages").value(2))
                .andExpect(jsonPath("$.pagination.hasPrevious").value(true));
    }

    @Test
    void phoneAliasUpdateDeleteEnforceOwnership() throws Exception {
        UUID addressId = UUID.randomUUID();
        AddressResponse response = new AddressResponse();
        response.setId(addressId);
        when(customerAddressService.updateAddressByPhone(eq("9999999999"), eq(addressId), any(AddressRequest.class))).thenReturn(response);
        when(customerAddressService.updateAddressByPhone(eq("8888888888"), eq(addressId), any(AddressRequest.class)))
                .thenThrow(new NotFoundException("Address not found for customer"));

        mockMvc.perform(put("/customer/{phone}/addresses/{addressId}", "9999999999", addressId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Jane\",\"phone\":\"9999999999\",\"addressLine1\":\"line1\",\"city\":\"Pune\",\"state\":\"MH\",\"pincode\":\"411001\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.address.id").value(addressId.toString()));

        mockMvc.perform(delete("/customer/{phone}/addresses/{addressId}", "9999999999", addressId))
                .andExpect(status().isOk());
        verify(customerAddressService).deleteAddressByPhone("9999999999", addressId);

        mockMvc.perform(put("/customer/{phone}/addresses/{addressId}", "8888888888", addressId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Jane\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    void createAddressByPhoneUsesOwnerPhoneAndKeepsContactPhone() throws Exception {
        UUID addressId = UUID.randomUUID();
        AddressResponse response = new AddressResponse();
        response.setId(addressId);
        response.setPhone("7777777777");
        when(customerAddressService.createAddressByPhone(eq("9999999999"), any(AddressRequest.class))).thenReturn(response);

        mockMvc.perform(post("/customer/addresses")
                        .param("customerPhone", "9999999999")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Jane\",\"phone\":\"7777777777\",\"addressLine1\":\"line1\",\"city\":\"Pune\",\"state\":\"MH\",\"pincode\":\"411001\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.address.phone").value("7777777777"));
        verify(customerAddressService).createAddressByPhone(eq("9999999999"), any(AddressRequest.class));

        mockMvc.perform(post("/customer/addresses")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Jane\",\"phone\":\"7777777777\",\"addressLine1\":\"line1\",\"city\":\"Pune\",\"state\":\"MH\",\"pincode\":\"411001\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("customerPhone is required"));
        verify(customerAddressService, never()).createAddressByPhone(eq("7777777777"), any(AddressRequest.class));
    }

    @Test
    void supportsPetsRoutesAndValidationEnvelope() throws Exception {
        UUID customerId = UUID.randomUUID();
        UUID petId = UUID.randomUUID();
        PetResponse response = new PetResponse();
        response.setId(petId);
        when(petService.getPet(petId)).thenReturn(response);
        PaginatedResult<PetResponse> pagedPetResult =
                new PaginatedResult<>(List.of(response), new PaginationMetadata(0, 10, 1, 1, false, false));
        when(petService.getPets(eq(customerId), anyInt(), anyInt(), anyString())).thenReturn(pagedPetResult);
        when(petService.getPetsByPhone(eq("9999999999"), anyInt(), anyInt(), anyString())).thenReturn(pagedPetResult);
        when(petService.replacePetsByPhone(eq("9999999999"), any())).thenReturn(List.of(response));
        when(petService.getPetByPhone(eq("9999999999"), eq(petId))).thenReturn(response);
        when(petService.updatePetByPhone(eq("9999999999"), eq(petId), any(AddPetRequest.class))).thenReturn(response);

        AddPetRequest createRequest = new AddPetRequest();
        createRequest.setCustomerId(customerId);
        createRequest.setName("Milo");
        createRequest.setSpecies("dog");
        mockMvc.perform(post("/pets")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createRequest)))
                .andExpect(status().isOk());

        mockMvc.perform(get("/pets/{petId}", petId))
                .andExpect(status().isOk());
        mockMvc.perform(get("/customer/pets/{petId}", petId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pet.id").value(petId.toString()));
        mockMvc.perform(get("/customer/{phone}/pets/{petId}", "9999999999", petId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pet.id").value(petId.toString()));
        mockMvc.perform(get("/pets/customer/{customerId}", customerId))
                .andExpect(status().isOk());
        mockMvc.perform(get("/customer/pets/{phone}", "9999999999"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pets[0].id").value(petId.toString()))
                .andExpect(jsonPath("$.pagination.totalElements").value(1));
        mockMvc.perform(get("/customer/pets").param("phone", "9999999999"))
                .andExpect(status().isOk());
        mockMvc.perform(post("/customer/pets")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\":\"9999999999\",\"pets\":[{\"name\":\"Milo\",\"petType\":\"dog\"}]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pets[0].id").value(petId.toString()));
        mockMvc.perform(put("/customer/{phone}/pets/{petId}", "9999999999", petId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Milo\",\"petType\":\"dog\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pet.id").value(petId.toString()));
        mockMvc.perform(delete("/customer/{phone}/pets/{petId}", "9999999999", petId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Pet deleted successfully"));
        mockMvc.perform(get("/customer/{phone}/pets/{petId}/bookings", "9999999999", petId))
                .andExpect(status().isNotImplemented())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Pet bookings are managed outside customer-service"));

        mockMvc.perform(post("/pets")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"customerId\":\"" + customerId + "\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Validation failed"));
    }

    @Test
    void notFoundUsesStandardErrorEnvelope() throws Exception {
        UUID customerId = UUID.randomUUID();
        when(customerService.getCustomerById(customerId)).thenThrow(new NotFoundException("Customer not found"));

        mockMvc.perform(get("/customer/{customerId}", customerId))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Customer not found"));
    }

    @Test
    void saveProfileRequiresPhone() throws Exception {
        mockMvc.perform(post("/customer/profile")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"profile\":{\"firstName\":\"Jane\"}}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("phone is required"));
    }

    @Test
    void saveProfileWithValidPhoneReturnsSuccessEnvelope() throws Exception {
        UUID customerId = UUID.randomUUID();
        CustomerResponse customer = new CustomerResponse();
        customer.setId(customerId);
        customer.setPhone("9999999999");
        when(customerService.getCustomerByPhone("9999999999")).thenReturn(customer);
        when(customerService.getCustomerById(customerId)).thenReturn(customer);

        mockMvc.perform(post("/customer/profile")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\":\"9999999999\",\"profile\":{\"firstName\":\"Jane\"}}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.customer.id").value(customerId.toString()))
                .andExpect(jsonPath("$.profile.id").value(customerId.toString()));
    }

    @Test
    void updateProfileByIdentifierUsesExistingProfileUpdateFlow() throws Exception {
        UUID customerId = UUID.randomUUID();
        CustomerResponse customer = new CustomerResponse();
        customer.setId(customerId);
        customer.setPhone("9999999999");
        when(customerService.getCustomerByPhone("9999999999")).thenReturn(customer);
        when(customerService.getCustomerById(customerId)).thenReturn(customer);

        mockMvc.perform(put("/customer/profile/{identifier}", "9999999999")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"firstName\":\"Jane\",\"lastName\":\"Doe\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.profile.id").value(customerId.toString()));

        verify(customerService).updateCustomer(eq(customerId), any(UpdateCustomerRequest.class));
    }

    @Test
    void phonePreferenceRoutesResolveCustomerAndReusePreferenceService() throws Exception {
        UUID customerId = UUID.randomUUID();
        CustomerResponse customer = new CustomerResponse();
        customer.setId(customerId);
        CustomerPreferencesRequest preferences = new CustomerPreferencesRequest();
        preferences.setJourneyType("have-pet");
        when(customerService.getCustomerByPhone("9999999999")).thenReturn(customer);
        when(customerPreferenceService.savePreferences(eq(customerId), any(CustomerPreferencesRequest.class))).thenReturn(preferences);
        when(customerPreferenceService.getPreferences(customerId)).thenReturn(preferences);

        mockMvc.perform(post("/customer/{phone}/preferences", "9999999999")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"journeyType\":\"have-pet\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.journeyType").value("have-pet"));

        mockMvc.perform(get("/customer/{phone}/preferences", "9999999999"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.journeyType").value("have-pet"));

        verify(customerPreferenceService).savePreferences(eq(customerId), any(CustomerPreferencesRequest.class));
        verify(customerPreferenceService).getPreferences(customerId);
    }

    @Test
    void phoneRoutesRejectInvalidPhoneAndWrongPetOwner() throws Exception {
        UUID petId = UUID.randomUUID();
        when(petService.getPetByPhone(eq("8888888888"), eq(petId)))
                .thenThrow(new NotFoundException("Pet not found"));

        mockMvc.perform(get("/customer/{phone}/preferences", "abc"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("phone must be 10-15 digits"));

        mockMvc.perform(get("/customer/{phone}/pets/{petId}", "abc", petId))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("phone must be 10-15 digits"));

        mockMvc.perform(get("/customer/{phone}/pets/{petId}", "8888888888", petId))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Pet not found"));
    }

    @Test
    void customerPhoneRoutesRejectInvalidPhoneWithStandardEnvelope() throws Exception {
        mockMvc.perform(get("/customer/by-phone").param("phone", "abc"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("phone must be 10-15 digits"))
                .andExpect(jsonPath("$.data").isMap());

        mockMvc.perform(post("/customer/profile")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\":\"++\",\"profile\":{\"firstName\":\"Jane\"}}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("phone must be 10-15 digits"))
                .andExpect(jsonPath("$.data").isMap());
    }

    @Test
    void idempotencyKeyDuplicateCreateReturnsCachedEnvelope() throws Exception {
        UUID customerId = UUID.randomUUID();
        CustomerResponse response = new CustomerResponse();
        response.setId(customerId);
        CommonResponse<CustomerResponse> cached = CommonResponse.success(response, "Customer created or already exists");
        cached.setCustomer(response);
        when(idempotencyService.execute(anyString(), eq("dup-1"), any(), any(Supplier.class), eq(CommonResponse.class)))
                .thenReturn(cached);

        mockMvc.perform(post("/customer")
                        .header("Idempotency-Key", "dup-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\":\"9999999999\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.customer.id").value(customerId.toString()));
        verify(customerService, never()).createCustomer(any());
    }
}
