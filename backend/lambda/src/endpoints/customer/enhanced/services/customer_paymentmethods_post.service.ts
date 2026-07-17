import type { Context } from 'hono';
import * as customer_paymentmethods_postRepo from '../repos/customer_paymentmethods_post.repo';
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

export async function executecustomerPaymentmethodsPost(c: Context) {
    try {
      const body = await c.req.json();
      const { phone, customerId, type, razorpayToken, last4, brand, upiId, bankName, isDefault } = body;

      if (!phone && !customerId) {
        return c.json({ error: 'phone or customerId is required' }, 400);
      }

      const paymentType = String(type ?? body.method ?? '').trim().toLowerCase();
      if (!paymentType || !['card', 'upi', 'netbanking'].includes(paymentType)) {
        return c.json({ error: 'Valid payment type (card, upi, netbanking) is required' }, 400);
      }

      let customer: any = null;
      if (customerId) {
        const customers = await customer_paymentmethods_postRepo.dbCustomerPaymentmethodsPost0(customerId)
        customer = customers[0];
      } else if (phone) {
        const customers = await customer_paymentmethods_postRepo.dbCustomerPaymentmethodsPost1(phone)
        customer = customers[0];
      }

      if (!customer) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      // If setting as default, unset other defaults
      if (isDefault) {
        await customer_paymentmethods_postRepo.dbCustomerPaymentmethodsPost2(customer).catch(() => {});
      }

      // Insert new payment method
      const insertRow: Record<string, unknown> = {
        customer_id: customer.id,
        payment_type: paymentType,
        is_default: isDefault || false,
        is_active: true,
      };
      if (razorpayToken != null && String(razorpayToken).trim() !== '') {
        insertRow.razorpay_token = razorpayToken;
      }
      if (last4 != null && String(last4).trim() !== '') insertRow.card_last4 = last4;
      if (brand != null && String(brand).trim() !== '') insertRow.card_brand = brand;
      if (upiId != null && String(upiId).trim() !== '') insertRow.upi_id = upiId;
      if (bankName != null && String(bankName).trim() !== '') insertRow.bank_name = bankName;

      const inserted = await customer_paymentmethods_postRepo.dbCustomerPaymentmethodsPost3(insertRow);

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