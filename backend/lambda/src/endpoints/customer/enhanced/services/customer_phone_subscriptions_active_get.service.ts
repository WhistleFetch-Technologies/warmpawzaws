import type { Context } from 'hono';
import * as customer_phone_subscriptions_active_getRepo from '../repos/customer_phone_subscriptions_active_get.repo';
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

export async function executecustomerPhoneSubscriptionsActiveGet(c: Context) {
    try {
      const phone = c.req.param('phone');
      const serviceId = c.req.query('serviceId');
      const normalizedPhone = phone.replace(/\D/g, '');

      // Get customer by phone
      const customers = await customer_phone_subscriptions_active_getRepo.dbCustomerPhoneSubscriptionsActiveGet0(normalizedPhone)
      if (customers.length === 0) {
        return c.json({ success: true, hasActiveSubscription: false, subscriptions: [] });
      }

      const customer = customers[0];

      // Get active subscriptions
      const subscriptionsQuery = `
        SELECT s.*, 
               vs.name as service_name,
               vs.service_type,
               v.business_name as vendor_name
        FROM customer_subscriptions s
        LEFT JOIN vendor_services vs ON s.service_id = vs.id
        LEFT JOIN vendors v ON s.vendor_id = v.id
        WHERE s.customer_id = $1
          AND s.status = 'active'
          AND (s.expires_at IS NULL OR s.expires_at > NOW())
          ${serviceId ? 'AND (s.service_id = $2 OR s.service_id IS NULL)' : ''}
        ORDER BY s.created_at DESC
      `;

      const params = serviceId ? [customer.id, serviceId] : [customer.id];
      const subscriptionsResult = await customer_phone_subscriptions_active_getRepo.dbCustomerPhoneSubscriptionsActiveGet1(subscriptionsQuery, params)

      const subscriptions = (subscriptionsResult as any).rows.map((sub: any) => ({
        id: sub.id,
        type: sub.subscription_type || 'unlimited',
        serviceId: sub.service_id,
        serviceName: sub.service_name,
        serviceType: sub.service_type,
        vendorId: sub.vendor_id,
        vendorName: sub.vendor_name,
        coversFees: sub.covers_fees || false,
        expiresAt: sub.expires_at,
        createdAt: sub.created_at,
      }));

      const hasActiveSubscription = subscriptions.length > 0;
      
      // Check if subscription covers the specific service
      const coversService = serviceId 
        ? subscriptions.some((s: any) => !s.serviceId || s.serviceId === serviceId)
        : hasActiveSubscription;

      return c.json({
        success: true,
        hasActiveSubscription,
        coversService,
        subscriptions,
      });
    } catch (error: any) {
      console.error('Error checking active subscriptions:', error);
      return c.json({ 
        success: true, 
        hasActiveSubscription: false, 
        subscriptions: [],
        error: error.message 
      });
    }
}