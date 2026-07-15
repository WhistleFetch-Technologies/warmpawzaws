import type { Context } from 'hono';
import * as customer_phone_preferences_getRepo from '../repos/customer_phone_preferences_get.repo';
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

export async function executecustomerPhonePreferencesGet(c: Context) {
    try {
      const phone = c.req.param('phone');

      // Get customer by phone
      const customers = await customer_phone_preferences_getRepo.dbCustomerPhonePreferencesGet0()
      if (customers.length === 0) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      const customer = customers[0];

      // Try to get preferences from dedicated table first
      const preferencesResult = await customer_phone_preferences_getRepo.dbCustomerPhonePreferencesGet1(customer).catch(() => ({ rows: [] }));

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