package com.warmpawz.customer.dto.request;

import lombok.Data;

import java.util.Map;

@Data
public class AddPetRequest {

    private String name;
    private String species;
    private String breed;

    private Integer ageYears;
    private Integer ageMonths;

    private String gender;
    private Double weightKg;

    private String photo;

    private Map<String, Object> medicalHistory;
}
