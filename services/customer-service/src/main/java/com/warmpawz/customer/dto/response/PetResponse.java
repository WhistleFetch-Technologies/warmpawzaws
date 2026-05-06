package com.warmpawz.customer.dto.response;

import lombok.Data;

import java.util.Map;
import java.util.UUID;

@Data
public class PetResponse {

    private UUID id;
    private String name;

    private String type; // species
    private String species;

    private String breed;

    private Integer ageYears;
    private Integer ageMonths;

    private String gender;

    private Double weightKg;

    private String photo;

    private Map<String, Object> medicalHistory;

    private String createdAt;
}
