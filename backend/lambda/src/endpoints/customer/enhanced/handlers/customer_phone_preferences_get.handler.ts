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

export async function customerPhonePreferencesGetHandler(c: Context) {
    try {
      const phone = c.req.param('phone');

      // Get customer by phone
      const customers = await select('customers', { phone });
      if (customers.length === 0) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      const customer = customers[0];

      // Try to get preferences from dedicated table first
      const preferencesResult = await query(
        `SELECT * FROM customer_preferences WHERE customer_id = $1`,
        [customer.id]
      ).catch(() => ({ rows: [] }));

      // Also get preferences from customer.preferences JSONB as fallback
      const customerPreferences = customer.preferences || {};

      const preferences = preferencesResult.rows.length > 0 
        ? preferencesResult.rows[0] 
        : customerPreferences;

      return c.json({
        success: true,
        preferences: {
          journeyType: preferences.journey_type || preferences.journeyType,
          livingSpace: {
            homeType: preferences.home_type || preferences.homeType,
            outdoorSpace: preferences.outdoor_space || preferences.outdoorSpace,
          },
          lifestyle: {
            workSchedule: preferences.work_schedule || preferences.workSchedule,
            activityLevel: preferences.activity_level || preferences.activityLevel,
            travelFrequency: preferences.travel_frequency || preferences.travelFrequency,
          },
          budget: preferences.monthly_budget || preferences.budget,
          servicePreferences: preferences.service_preferences || preferences.servicePreferences || [],
          onboardingCompletedAt: preferences.onboarding_completed_at,
        },
      });
    } catch (error: any) {
      console.error('Error fetching customer preferences:', error);
      return c.json({ error: error.message }, 500);
    }
}
