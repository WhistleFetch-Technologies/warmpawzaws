package com.warmpawz.customer.dto.request;

import lombok.Data;

import java.util.List;

@Data
public class LegacyPetsRequest {
    private String phone;
    private List<AddPetRequest> pets;
}
