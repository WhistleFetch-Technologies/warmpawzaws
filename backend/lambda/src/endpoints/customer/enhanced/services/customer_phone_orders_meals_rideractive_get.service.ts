import type { Context } from 'hono';
import * as customer_phone_orders_meals_rideractive_getRepo from '../repos/customer_phone_orders_meals_rideractive_get.repo';
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

export async function executecustomerPhoneOrdersMealsRideractiveGet(c: Context) {
    try {
      const phone = c.req.param('phone');

      let customer: any | null = null;
      try {
        customer = await findCustomerByPhone(phone);
      } catch (error: any) {
        console.error('[meals/rider-active] Error fetching customer:', error);
        return c.json({ success: true, order: null }, 200);
      }
      if (!customer) {
        return c.json({ success: true, order: null });
      }
      let ordersResult: any;
      try {
        ordersResult = await customer_phone_orders_meals_rideractive_getRepo.dbCustomerPhoneOrdersMealsRideractiveGet0(customer, MEAL_ACTIVE_ORDERS_SQL)
      } catch (error: any) {
        console.warn('[meals/rider-active] Error fetching orders:', error?.message);
        return c.json({ success: true, order: null }, 200);
      }

      const riderOrder = ((ordersResult as any)?.rows || [])
        .map(mapMealActiveOrderRow)
        .filter(Boolean)
        .find((o: { showRiderBar?: boolean }) => o.showRiderBar === true);

      return c.json({
        success: true,
        order: riderOrder ?? null,
      });
    } catch (error: any) {
      console.error('[meals/rider-active] Error:', error);
      return c.json({ success: true, order: null }, 200);
    }
}