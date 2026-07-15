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

export async function customerPhonePreferencesPostHandler(c: Context) {
    try {
      const phone = c.req.param('phone');
      const body = await c.req.json();

      const {
        journeyType,
        livingSpace,
        lifestyle,
        budget,
        servicePreferences,
        hasChildren,
        hasOtherPets,
        otherPetTypes,
      } = body;

      const customer = await findCustomerByPhone(phone);
      if (!customer) {
        return c.json({ error: 'Customer not found. Please create profile first.' }, 404);
      }

      // Check if preferences exist
      const existingPrefs = await query(
        `SELECT id FROM customer_preferences WHERE customer_id = $1`,
        [customer.id]
      ).catch(() => ({ rows: [] }));

      const preferencesData = {
        journey_type: journeyType,
        home_type: livingSpace?.homeType,
        outdoor_space: livingSpace?.outdoorSpace,
        work_schedule: lifestyle?.workSchedule,
        activity_level: lifestyle?.activityLevel,
        travel_frequency: lifestyle?.travelFrequency,
        monthly_budget: budget,
        service_preferences: servicePreferences || [],
        has_children: hasChildren,
        has_other_pets: hasOtherPets,
        other_pet_types: otherPetTypes || [],
        updated_at: new Date().toISOString(),
      };

      if (existingPrefs.rows.length > 0) {
        // Update existing preferences
        await query(
          `UPDATE customer_preferences SET
            journey_type = COALESCE($1, journey_type),
            home_type = COALESCE($2, home_type),
            outdoor_space = COALESCE($3, outdoor_space),
            work_schedule = COALESCE($4, work_schedule),
            activity_level = COALESCE($5, activity_level),
            travel_frequency = COALESCE($6, travel_frequency),
            monthly_budget = COALESCE($7, monthly_budget),
            service_preferences = COALESCE($8, service_preferences),
            has_children = COALESCE($9, has_children),
            has_other_pets = COALESCE($10, has_other_pets),
            other_pet_types = COALESCE($11, other_pet_types),
            updated_at = NOW()
          WHERE customer_id = $12`,
          [
            preferencesData.journey_type,
            preferencesData.home_type,
            preferencesData.outdoor_space,
            preferencesData.work_schedule,
            preferencesData.activity_level,
            preferencesData.travel_frequency,
            preferencesData.monthly_budget,
            JSON.stringify(preferencesData.service_preferences),
            preferencesData.has_children,
            preferencesData.has_other_pets,
            preferencesData.other_pet_types,
            customer.id,
          ]
        );
      } else {
        // Insert new preferences
        await query(
          `INSERT INTO customer_preferences (
            customer_id, journey_type, home_type, outdoor_space,
            work_schedule, activity_level, travel_frequency,
            monthly_budget, service_preferences, has_children,
            has_other_pets, other_pet_types
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            customer.id,
            preferencesData.journey_type,
            preferencesData.home_type,
            preferencesData.outdoor_space,
            preferencesData.work_schedule,
            preferencesData.activity_level,
            preferencesData.travel_frequency,
            preferencesData.monthly_budget,
            JSON.stringify(preferencesData.service_preferences),
            preferencesData.has_children,
            preferencesData.has_other_pets,
            preferencesData.other_pet_types,
          ]
        );
      }

      // Also update customer.preferences JSONB as backup
      await update('customers', { id: customer.id }, {
        preferences: {
          ...customer.preferences,
          journeyType,
          livingSpace,
          lifestyle,
          budget,
          servicePreferences,
        },
      });

      return c.json({
        success: true,
        message: 'Preferences saved successfully',
      });
    } catch (error: any) {
      console.error('Error saving customer preferences:', error);
      return c.json({ error: error.message }, 500);
    }
}
