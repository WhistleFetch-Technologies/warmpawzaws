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

export async function customerPaymentmethodsGetHandler(c: Context) {
    try {
      const phone = c.req.query('phone');
      const customerId = c.req.query('customerId');

      if (!phone && !customerId) {
        return c.json({ error: 'phone or customerId is required' }, 400);
      }

      let customer: any = null;
      if (customerId) {
        const customers = await select('customers', { id: customerId });
        customer = customers[0];
      } else if (phone) {
        const customers = await select('customers', { phone });
        customer = customers[0];
      }

      if (!customer) {
        return c.json({ methods: [] });
      }

      // Get saved payment methods from customer_payment_methods table
      const methodsResult = await query(
        `SELECT * FROM customer_payment_methods 
         WHERE customer_id = $1 AND is_active = true 
         ORDER BY is_default DESC, created_at DESC`,
        [customer.id]
      ).catch(() => ({ rows: [] }));

      const methods = Array.isArray(methodsResult) 
        ? methodsResult 
        : methodsResult.rows || [];

      return c.json({
        success: true,
        methods: methods.map((m: any) => ({
          id: m.id,
          type: m.payment_type || 'card',
          last4: m.card_last4,
          brand: m.card_brand,
          upiId: m.upi_id,
          bankName: m.bank_name,
          isDefault: m.is_default,
          expiryMonth: m.card_expiry_month,
          expiryYear: m.card_expiry_year,
        })),
      });
    } catch (error: any) {
      console.error('Error fetching payment methods:', error);
      return c.json({ methods: [] }); // Return empty array on error
    }
}
