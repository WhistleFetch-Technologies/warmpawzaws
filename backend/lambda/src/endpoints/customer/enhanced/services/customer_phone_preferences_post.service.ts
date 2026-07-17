import type { Context } from 'hono';
import * as customer_phone_preferences_postRepo from '../repos/customer_phone_preferences_post.repo';
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

export async function executecustomerPhonePreferencesPost(c: Context) {
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
      const existingPrefs = await customer_phone_preferences_postRepo.dbCustomerPhonePreferencesPost0(customer).catch(() => ({ rows: [] }));

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
        await customer_phone_preferences_postRepo.dbCustomerPhonePreferencesPost1(customer, preferencesData);
      } else {
        await customer_phone_preferences_postRepo.dbCustomerPhonePreferencesPost2(customer, preferencesData);
      }

      // Also update customer.preferences JSONB as backup
      await customer_phone_preferences_postRepo.dbCustomerPhonePreferencesPost3(customer, journeyType, livingSpace, lifestyle, budget, servicePreferences)

      return c.json({
        success: true,
        message: 'Preferences saved successfully',
      });
    } catch (error: any) {
      console.error('Error saving customer preferences:', error);
      return c.json({ error: error.message }, 500);
    }
}