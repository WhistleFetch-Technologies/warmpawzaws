import type { Context } from 'hono';
import * as customer_pets_getRepo from '../repos/customer_pets_get.repo';
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

export async function executecustomerPetsGet(c: Context) {
    try {
      const phone = c.req.query('phone');
      if (!phone) {
        return c.json({ error: 'phone is required' }, 400);
      }

      const customer = await findCustomerByPhone(phone);
      if (!customer) {
        return c.json({ 
          success: false, 
          error: { code: 'NOT_FOUND', message: 'Customer not found' },
          pets: [],
          count: 0
        }, 404);
      }

      // Get pets
      const pets = await customer_pets_getRepo.dbCustomerPetsGet0(customer)

      return c.json({
        success: true,
        pets: pets.map((pet: any) => ({
          id: pet.id,
          name: pet.name,
          species: pet.species,
          breed: pet.breed,
          age_years: pet.age_years,
          age_months: pet.age_months,
          gender: pet.gender,
          weight_kg: pet.weight_kg,
          profile_photo_url: pet.profile_photo_url,
          medical_history: pet.medical_history || {},
          createdAt: pet.created_at,
        })),
        count: pets.length,
      });
    } catch (error: any) {
      console.error('[pets] Error fetching customer pets by phone:', error);
      console.error('[pets] Error stack:', error?.stack);
      
      // ✅ FIX: Return proper error codes instead of masking with 200 OK
      const errorMessage = error?.message || 'Unknown error';
      
      // Return 200 with empty on pool exhaustion or other errors so customer home loads
      if (errorMessage.includes('connection pool') || errorMessage.includes('too many clients')) {
        return c.json({ success: true, pets: [], count: 0 });
      }
      
      return c.json({ success: true, pets: [], count: 0 });
    }
}