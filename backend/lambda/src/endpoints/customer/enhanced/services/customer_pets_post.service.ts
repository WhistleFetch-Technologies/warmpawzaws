import type { Context } from 'hono';
import * as customer_pets_postRepo from '../repos/customer_pets_post.repo';
import { createEnhancedApiGatewayEvent, createEnhancedLambdaContext } from '../../shared/hono-lambda-bridge.utils';
import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import { BaseHandlerEnhanced, HandlerContext, HandlerResponse } from '../../../../handler/base-handler-enhanced';
import {
  UpdateCustomerProfileRequestSchema,
  AddPetRequestSchema,
} from '@warmpawz/api-contracts/customers';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../../../../utils/entity-extractor';
import { isValidUUID } from '../../../../types/entities';
import { presignS3GetUrlIfApplicable } from '../../../../utils/s3-media-presign';
import {
  extractHealthRecordsForClient,
  extractVaccinationsForClient,
} from '../../../../utils/pet-health-normalize';
import {
  normalizeBloodTypeForStorage,
  resolveBloodTypeFromPayload,
} from '../../../../lib/pet-blood-types';
import { findCustomerByPhone } from '../../../../utils/customer-phone-lookup';
import { getDiscoveryRules } from '../../../../lib/rule-engine';
import {
  resolveCustomerMealPlanOrderDisplayTotals,
} from '../../../../utils/meal-order-pricing';
import {
  resolveEffectiveMealDeliveryState,
  isTerminalMealDeliveryState,
  shouldShowMealRiderFooterBar,
  mealRiderDeliveryMessage,
} from '../../../../utils/meal-delivery-effective-state';
import { enrichSubscriptionRowsWithPresignedMealImages } from '../../../../services/meal-subscription/meal-subscription-operations-service';
import { expireMealPaymentHolds } from '../../../../utils/meal-payment-hold';
import { getMealRefundReviewCustomerMetadata } from '../../../../utils/meal-refund-cases';
import { validatePetCreatePayload } from '../../../../utils/pet-create-validation';
import {
  buildPetLoyaltyResponseFields,
  createEmptyPetLoyaltyBatchState,
  recordPetInsertLoyalty,
  recordPetUpdateLoyalty,
} from '../../../../lib/pet-loyalty-response';

export async function executecustomerPetsPost(c: Context) {
    try {
      const body = await c.req.json();
      const { phone, pets } = body;

      if (!phone) {
        return c.json({ error: 'phone is required' }, 400);
      }

      if (!pets || !Array.isArray(pets)) {
        return c.json({ error: 'pets array is required' }, 400);
      }

      const customer = await findCustomerByPhone(phone);
      if (!customer) {
        return c.json({ error: 'Customer not found. Please create profile first.' }, 404);
      }

      const savedPets = [];
      const loyaltyState = createEmptyPetLoyaltyBatchState();

      for (const pet of pets) {
        try {
          const petSpecies = (pet.type || pet.species || '').toLowerCase();
          const allowedSpecies = ['dog', 'cat'];
          if (!allowedSpecies.includes(petSpecies)) {
            return c.json(
              {
                error: `Invalid pet type for "${pet.name || 'pet'}". Platform currently supports Dogs and Cats only.`,
              },
              400,
            );
          }

          // Check if pet already exists
          const existingPets = await customer_pets_postRepo.dbCustomerPetsPost0(customer, pet);

          if (existingPets.length === 0) {
            const createValidation = validatePetCreatePayload(pet, {
              requireCustomerId: false,
            });
            if (!createValidation.ok) {
              return c.json({ error: createValidation.error }, 400);
            }
          }
          
          // Normalize gender to lowercase for DB constraint
          const normalizedGender = pet.gender ? pet.gender.toLowerCase() : null;
          // Validate gender against allowed values
          const allowedGenders = ['male', 'female', 'neutered', 'spayed'];
          const validGender = normalizedGender && allowedGenders.includes(normalizedGender) ? normalizedGender : null;
          
          // ✅ ENHANCED: Calculate age from DOB if provided
          let age_years = pet.age ? parseInt(pet.age) : null;
          let age_months = null;
          if (pet.dob && !age_years) {
            const birthDate = new Date(pet.dob);
            const now = new Date();
            const ageInMonthsCalc = (now.getFullYear() - birthDate.getFullYear()) * 12 + 
                               (now.getMonth() - birthDate.getMonth());
            age_years = Math.floor(ageInMonthsCalc / 12);
            age_months = ageInMonthsCalc % 12;
          }
          
          // Build pet data matching the pets table schema
          // ✅ ENHANCED: Now supports vaccination records, allergies, chronic conditions, behavior notes
          const bloodTypeResult = resolveBloodTypeFromPayload(pet, petSpecies);
          if (!bloodTypeResult.ok) {
            return c.json({ error: bloodTypeResult.error }, 400);
          }

          const healthRecords = { ...(pet.healthRecords || {}) };
          delete healthRecords.bloodType;

          const petData: Record<string, any> = {
            customer_id: customer.id,
            name: pet.name,
            species: petSpecies,
            breed: pet.breed || null,
            age_years: age_years,
            age_months: age_months,
            gender: validGender,
            weight_kg: pet.weight ? parseFloat(pet.weight) : null,
            profile_photo_url: pet.photo || null,
            // Store health records and vaccinations in medical_history JSONB
            medical_history: {
              ...healthRecords,
              dob: pet.dob || null,
              microchipId: pet.microchipId || null,
              allergies: pet.allergies || [],
              chronicConditions: pet.chronicConditions || [],
              vaccinations: pet.vaccinations || [],
              behaviorNotes: pet.behaviorNotes || null,
              feedingSchedule: pet.feedingSchedule || null,
              dietaryRestrictions: pet.dietaryRestrictions || [],
              spayedNeutered: pet.spayedNeutered || false,
              specialNeeds: pet.specialNeeds || null,
              emergencyContact: pet.emergencyContact || null,
              color: pet.color || null,
              size: pet.size || null,
            },
          };
          if (bloodTypeResult.value) {
            petData.medical_history.bloodType = bloodTypeResult.value;
          }

          if (existingPets.length > 0) {
            // Update existing pet
            const beforePet = existingPets[0] as Record<string, unknown>;
            const updated = await customer_pets_postRepo.dbCustomerPetsPost1(existingPets, petData)
            const afterPet = updated[0] as Record<string, unknown>;
            recordPetUpdateLoyalty(
              loyaltyState,
              String(existingPets[0].id),
              beforePet,
              afterPet,
              pet as Record<string, unknown>
            );
            savedPets.push({ ...afterPet, id: existingPets[0].id });
          } else {
            // Insert new pet
            const inserted = await customer_pets_postRepo.dbCustomerPetsPost2(petData)
            const newPet = inserted[0];
            recordPetInsertLoyalty(
              loyaltyState,
              String(newPet.id),
              newPet as Record<string, unknown>,
              pet as Record<string, unknown>
            );
            savedPets.push(newPet);
          }
        } catch (petError: any) {
          console.error(`Error saving pet ${pet.name}:`, petError);
        }
      }

      // Update customer onboarding status to COMPLETED since pets are now saved
      try {
        const { updateCustomerOnboardingStatus } = await import('../../../../utils/customer-state');
        await updateCustomerOnboardingStatus(customer.id, 'COMPLETED', 'completed');
        
        // Also update profile_completed flag
        await customer_pets_postRepo.dbCustomerPetsPost3(customer)
      } catch (stateError) {
        console.error('Error updating onboarding status:', stateError);
      }

      const loyaltyFields = buildPetLoyaltyResponseFields(
        loyaltyState,
        String(customer.id),
        savedPets[0]?.id ?? null
      );

      return c.json({
        success: true,
        message: `${savedPets.length} pet(s) saved successfully`,
        pets: savedPets,
        ...loyaltyFields,
      });
    } catch (error: any) {
      console.error('Error saving customer pets:', error);
      return c.json({ error: error.message }, 500);
    }
}