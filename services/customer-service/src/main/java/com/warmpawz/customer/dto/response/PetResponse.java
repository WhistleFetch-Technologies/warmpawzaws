package com.warmpawz.customer.dto.response;

import lombok.Data;

import java.util.Map;
import java.util.UUID;
import java.util.List;

@Data
public class PetResponse {

    private UUID id;
    private String name;

    private String type; // species
    private String species;

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

    private String createdAt;
}
