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

export async function customerByphoneGetHandler(c: Context) {
    const startTime = Date.now();
    try {
      const phone = c.req.query('phone');
      
      if (!phone) {
        return c.json({ 
          success: false,
          error: { code: 'MISSING_PHONE', message: 'phone parameter is required' }
        }, 400);
      }

      const event = createApiGatewayEvent(c.req);
      event.queryStringParameters = Object.fromEntries(new URL(c.req.url, 'http://localhost').searchParams);
      const context = createLambdaContext();
      
      try {
        const result: any = await getByPhoneHandler.execute(event, context);
        const body = JSON.parse(result.body);
        const duration = Date.now() - startTime;
        if (duration > 2000) {
          console.warn(`[by-phone] Slow response: ${duration}ms for phone ${phone.substring(0, 4)}****`);
        }
        return c.json(body, result.statusCode);
      } catch (error: any) {
        const duration = Date.now() - startTime;
        const errorMessage = error?.message || String(error);
        console.error(`[by-phone] Error after ${duration}ms:`, errorMessage);
        // ✅ Enhanced logging for 503 diagnosis
        if (errorMessage.includes('connection pool') || errorMessage.includes('too many clients')) {
          console.error('[by-phone] ⚠️ Connection pool exhausted');
        }
        return c.json({ success: false, customer: null }, 200);
      }
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(`[by-phone] Error after ${duration}ms:`, error?.message || error);
      return c.json({ success: false, customer: null }, 200);
    }
}
