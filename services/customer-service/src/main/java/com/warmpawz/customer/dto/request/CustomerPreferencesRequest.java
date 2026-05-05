package com.warmpawz.customer.dto.request;

import lombok.Data;

import java.util.List;

@Data
public class CustomerPreferencesRequest {

    private String journeyType;

    private LivingSpace livingSpace;
    private Lifestyle lifestyle;

    private String budget;

    private List<String> servicePreferences;

    private Boolean hasChildren;
    private Boolean hasOtherPets;

    private List<String> otherPetTypes;

    @Data
    public static class LivingSpace {
        private String homeType;
        private String outdoorSpace;
    }

    @Data
    public static class Lifestyle {
        private String workSchedule;
        private String activityLevel;
        private String travelFrequency;
    }
}
