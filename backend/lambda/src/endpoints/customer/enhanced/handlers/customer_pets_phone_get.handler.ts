import type { Context } from 'hono';
/**
 * ============================================================================
 * CUSTOMER ENDPOINTS - ENHANCED VERSION (PHASE 5)
 * ============================================================================
 * 
 * Migrated to use:
 * - BaseHandlerEnhanced for CloudWatch logging and error handling
 * - API Contracts (Zod) for validation
 * - Standardized response format
 * 
 * Endpoints:
 * - GET /customer/:customerId - Get customer profile
 * - GET /customer/by-phone - Get customer by phone
 * - PUT /customer/:customerId - Update customer profile
 * - GET /customer/:customerId/pets - Get customer pets
 * - POST /customer/:customerId/pets - Add pet
 * 
 * Date: 2026-01-28
 * Phase: 5
 * ============================================================================
 */

import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import { BaseHandlerEnhanced, HandlerContext, HandlerResponse } from '../../../../handler/base-handler-enhanced';
import { query, select, insert, update } from '../../../../database/rds-connection';
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

export async function customerPetsPhoneGetHandler(c: Context) {
    try {
      const param = c.req.param('phone');
      if (!param) {
        return c.json({ error: 'phone is required' }, 400);
      }

      // This route is registered before pets.ts; path param is used for phone OR pet UUID.
      if (isValidUUID(param)) {
        const rows = await select('pets', { id: param });
        if (rows.length === 0) {
          return c.json({ success: false, error: 'Pet not found' }, 404);
        }
        const pet = rows[0];
        const rawPhoto = pet.profile_photo_url;
        const photoUrl = (await presignS3GetUrlIfApplicable(rawPhoto)) || rawPhoto;
        const bloodType = normalizeBloodTypeForStorage(pet.medical_history?.bloodType, pet.species);
        return c.json({
          success: true,
          pet: {
            id: pet.id,
            name: pet.name,
            type: pet.species || 'Dog',
            species: pet.species,
            breed: pet.breed,
            age: pet.age_years?.toString() || '',
            age_years: pet.age_years,
            age_months: pet.age_months,
            gender: pet.gender,
            weight: pet.weight_kg?.toString() || '',
            weight_kg: pet.weight_kg,
            photo: photoUrl,
            profile_photo_url: photoUrl,
            microchipId: pet.microchip_id,
            ...(bloodType ? { bloodType } : {}),
            healthRecords: extractHealthRecordsForClient(pet.medical_history, pet.species),
            vaccinations: extractVaccinationsForClient(pet),
            createdAt: pet.created_at,
          },
        });
      }

      const customer = await findCustomerByPhone(param);
      if (!customer) {
        return c.json({ pets: [], count: 0 });
      }

      // Get pets
      const pets = await select('pets',
        { customer_id: customer.id },
        { orderBy: 'created_at', orderDirection: 'DESC' }
      );

      const petsOut = await Promise.all(
        pets.map(async (pet: any) => {
          const rawPhoto = pet.profile_photo_url;
          const photoUrl = (await presignS3GetUrlIfApplicable(rawPhoto)) || rawPhoto;
          const bloodType = normalizeBloodTypeForStorage(pet.medical_history?.bloodType, pet.species);
          return {
            id: pet.id,
            name: pet.name,
            type: pet.species || 'Dog',
            species: pet.species,
            breed: pet.breed,
            age: pet.age_years?.toString() || '',
            gender: pet.gender,
            weight: pet.weight_kg?.toString() || '',
            photo: photoUrl,
            image: photoUrl,
            profile_photo_url: photoUrl,
            microchipId: pet.microchip_id,
            ...(bloodType ? { bloodType } : {}),
            healthRecords: extractHealthRecordsForClient(pet.medical_history, pet.species),
            vaccinations: extractVaccinationsForClient(pet),
            createdAt: pet.created_at,
          };
        })
      );

      return c.json({
        success: true,
        pets: petsOut,
        count: petsOut.length,
      });
    } catch (error: any) {
      console.error('[pets/:phone] Error fetching customer pets by phone:', error);
      console.error('[pets/:phone] Error stack:', error?.stack);
      
      const errorMessage = error?.message || 'Unknown error';
      
      // ✅ FIX: Handle missing table gracefully - return empty pets
      if (errorMessage.includes('relation') && errorMessage.includes('does not exist')) {
        console.log('[pets/:phone] Table does not exist, returning empty pets');
        return c.json({
          success: true,
          pets: [],
          count: 0,
        });
      }
      
      // Return 200 with empty on pool exhaustion or other errors so customer home loads
      return c.json({ success: true, pets: [], count: 0 });
    }
}
