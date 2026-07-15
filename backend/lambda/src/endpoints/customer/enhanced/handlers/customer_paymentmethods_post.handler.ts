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

export async function customerPaymentmethodsPostHandler(c: Context) {
    try {
      const body = await c.req.json();
      const { phone, customerId, type, razorpayToken, last4, brand, upiId, bankName, isDefault } = body;

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
        return c.json({ error: 'Customer not found' }, 404);
      }

      // If setting as default, unset other defaults
      if (isDefault) {
        await query(
          `UPDATE customer_payment_methods SET is_default = false WHERE customer_id = $1`,
          [customer.id]
        ).catch(() => {});
      }

      // Insert new payment method
      const inserted = await insert('customer_payment_methods', {
        customer_id: customer.id,
        payment_type: type,
        razorpay_token: razorpayToken,
        card_last4: last4,
        card_brand: brand,
        upi_id: upiId,
        bank_name: bankName,
        is_default: isDefault || false,
        is_active: true,
      });

      return c.json({
        success: true,
        method: inserted[0],
        message: 'Payment method saved successfully',
      });
    } catch (error: any) {
      console.error('Error saving payment method:', error);
      return c.json({ error: error.message }, 500);
    }
}
