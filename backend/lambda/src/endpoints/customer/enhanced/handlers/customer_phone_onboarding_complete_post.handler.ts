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

export async function customerPhoneOnboardingCompletePostHandler(c: Context) {
    try {
      const phone = c.req.param('phone');
      const body = await c.req.json();
      const { journeyType } = body;

      // Get customer by phone
      const customers = await select('customers', { phone });
      if (customers.length === 0) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      const customer = customers[0];

      // Update customer onboarding status
      await update('customers', { id: customer.id }, {
        onboarding_status: 'COMPLETED',
        profile_completed: true,
        status: 'active',
      });

      // Update preferences with completion timestamp
      await query(
        `UPDATE customer_preferences SET
          onboarding_completed_at = NOW(),
          journey_type = COALESCE($1, journey_type)
        WHERE customer_id = $2`,
        [journeyType, customer.id]
      ).catch(() => {
        // Create preferences record if it doesn't exist
        return query(
          `INSERT INTO customer_preferences (customer_id, journey_type, onboarding_completed_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (customer_id) DO UPDATE SET onboarding_completed_at = NOW()`,
          [customer.id, journeyType]
        );
      });

      return c.json({
        success: true,
        message: 'Onboarding completed successfully',
        customerId: customer.id,
      });
    } catch (error: any) {
      console.error('Error completing onboarding:', error);
      return c.json({ error: error.message }, 500);
    }
}
