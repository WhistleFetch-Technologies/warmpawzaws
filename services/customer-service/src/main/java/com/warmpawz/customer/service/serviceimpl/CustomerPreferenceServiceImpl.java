package com.warmpawz.customer.service.serviceimpl;

import com.warmpawz.customer.dto.request.CustomerPreferencesRequest;
import com.warmpawz.customer.entity.CustomerPreference;
import com.warmpawz.customer.repository.CustomerPreferenceRepository;
import com.warmpawz.customer.service.CustomerPreferenceService;
import com.warmpawz.customer.service.CustomerProfileCompletionService;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class CustomerPreferenceServiceImpl implements CustomerPreferenceService {

    private final CustomerPreferenceRepository preferenceRepository;
    private final CustomerProfileCompletionService completionService;
    // =========================
    // SAVE / UPDATE (UPSERT)
    // =========================
    @Override
    public CustomerPreferencesRequest savePreferences(UUID customerId, CustomerPreferencesRequest request) {

        CustomerPreference pref = preferenceRepository.findByCustomerId(customerId)
                .orElseGet(() -> {
                    CustomerPreference p = new CustomerPreference();
                    p.setCustomerId(customerId);
                    return p;
                });

        // =========================
        // MAP REQUEST → ENTITY (FLAT)
        // =========================

        pref.setJourneyType(request.getJourneyType());

        if (request.getLivingSpace() != null) {
            pref.setHomeType(request.getLivingSpace().getHomeType());
            pref.setOutdoorSpace(request.getLivingSpace().getOutdoorSpace());
        }

        if (request.getLifestyle() != null) {
            pref.setWorkSchedule(request.getLifestyle().getWorkSchedule());
            pref.setActivityLevel(request.getLifestyle().getActivityLevel());
            pref.setTravelFrequency(request.getLifestyle().getTravelFrequency());
        }

        pref.setMonthlyBudget(request.getBudget());
        pref.setServicePreferences(request.getServicePreferences());

        pref.setHasChildren(request.getHasChildren());
        pref.setHasOtherPets(request.getHasOtherPets());
        pref.setOtherPetTypes(request.getOtherPetTypes());

        pref.setUpdatedAt(Instant.now());

        preferenceRepository.save(pref);
        completionService.markPreferencesCompleted(customerId);
        // =========================
        // RETURN SAME STRUCTURE
        // =========================
        return mapToResponse(pref);
    }

    // =========================
    // GET PREFERENCES
    // =========================
    @Override
    @Transactional(readOnly = true)
    public CustomerPreferencesRequest getPreferences(UUID customerId) {

        CustomerPreference pref = preferenceRepository.findByCustomerId(customerId)
                .orElseThrow(() -> new EntityNotFoundException("Preferences not found"));

        return mapToResponse(pref);
    }

    // =========================
    // ENTITY → RESPONSE (NESTED)
    // =========================
    private CustomerPreferencesRequest mapToResponse(CustomerPreference pref) {

        CustomerPreferencesRequest response = new CustomerPreferencesRequest();

        response.setJourneyType(pref.getJourneyType());
        response.setBudget(pref.getMonthlyBudget());

        // LivingSpace
        CustomerPreferencesRequest.LivingSpace living = new CustomerPreferencesRequest.LivingSpace();
        living.setHomeType(pref.getHomeType());
        living.setOutdoorSpace(pref.getOutdoorSpace());
        response.setLivingSpace(living);

        // Lifestyle
        CustomerPreferencesRequest.Lifestyle lifestyle = new CustomerPreferencesRequest.Lifestyle();
        lifestyle.setWorkSchedule(pref.getWorkSchedule());
        lifestyle.setActivityLevel(pref.getActivityLevel());
        lifestyle.setTravelFrequency(pref.getTravelFrequency());
        response.setLifestyle(lifestyle);

        response.setServicePreferences(pref.getServicePreferences());
        response.setHasChildren(pref.getHasChildren());
        response.setHasOtherPets(pref.getHasOtherPets());
        response.setOtherPetTypes(pref.getOtherPetTypes());

        return response;
    }
}