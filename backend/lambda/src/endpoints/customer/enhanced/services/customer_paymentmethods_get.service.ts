import type { Context } from 'hono';
import * as customer_paymentmethods_getRepo from '../repos/customer_paymentmethods_get.repo';
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

export async function executecustomerPaymentmethodsGet(c: Context) {
    try {
      const phone = c.req.query('phone');
      const customerId = c.req.query('customerId');

      if (!phone && !customerId) {
        return c.json({ error: 'phone or customerId is required' }, 400);
      }

      let customer: any = null;
      if (customerId) {
        const customers = await customer_paymentmethods_getRepo.dbCustomerPaymentmethodsGet0(customerId)
        customer = customers[0];
      } else if (phone) {
        const customers = await customer_paymentmethods_getRepo.dbCustomerPaymentmethodsGet1()
        customer = customers[0];
      }

      if (!customer) {
        return c.json({ methods: [] });
      }

      // Get saved payment methods from customer_payment_methods table
      const methodsResult = await customer_paymentmethods_getRepo.dbCustomerPaymentmethodsGet2(customer).catch(() => ({ rows: [] }));

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