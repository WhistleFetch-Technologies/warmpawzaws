package com.warmpawz.customer.dto.request;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Data
public class AddPetRequest {

    private UUID customerId;
    private String phone;

    @NotBlank(message = "Pet name is required")
    private String name;
    private String species;
    private String type;
    private String petType;
    private String breed;

    private Integer ageYears;
    private Integer ageMonths;
    private Integer age;
    private String ageUnit;

    private String gender;
    private Double weightKg;
    private Double weight;

    private String photo;
    private List<String> photos;

    private Map<String, Object> medicalHistory;
    private Boolean vaccinationStatus;
    private Boolean spayedNeutered;
    private Boolean microchipped;
    private String specialNeeds;

    @AssertTrue(message = "Species is required")
    public boolean isSpeciesPresent() {
        return hasText(species) || hasText(type) || hasText(petType);
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
