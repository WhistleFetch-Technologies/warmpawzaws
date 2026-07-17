import type { Context } from 'hono';
import * as customer_mealplanorders_getRepo from '../repos/customer_mealplanorders_get.repo';
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

export async function executecustomerMealplanordersGet(c: Context) {
    try {
      let customerId = String(c.req.query('customerId') || '').trim();
      const phone = String(c.req.query('phone') || '').trim();

      if (phone) {
        const row = await findCustomerByPhone(phone);
        const phoneCustomerId = row?.id ? String(row.id) : '';
        if (phoneCustomerId) {
          if (customerId && customerId !== phoneCustomerId) {
            console.warn(
              `[meal-plan-orders] customerId/phone mismatch queryCustomerId=${customerId} phoneCustomerId=${phoneCustomerId}`
            );
          }
          customerId = phoneCustomerId;
        }
      }

      if (!customerId) {
        return c.json({ success: false, error: 'customerId or phone is required' }, 400);
      }

      await expireMealPaymentHolds({ limit: 30, requestId: randomUUID() }).catch((e) =>
        console.warn('[meal-plan-orders] payment hold sweep failed:', e?.message || e)
      );

      const allOrders: any[] = [];

      // 1. From meal_orders (MealOrderCheckout flow)
      let mealResult: { rows?: unknown[] };
      try {
        mealResult = await customer_mealplanorders_getRepo.dbCustomerMealplanordersGet0(customerId)
      } catch (queryErr: unknown) {
        console.error(
          '[meal-plan-orders] meal_orders query failed:',
          queryErr instanceof Error ? queryErr.message : queryErr
        );
        mealResult = { rows: [] };
      }

      const safeMoney = (v: unknown) => {
        if (v === null || v === undefined || v === '') return 0;
        const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
        return Number.isFinite(n) ? n : 0;
      };

      for (const o of (mealResult as any).rows || []) {
        const planForPricing = {
          price_per_meal: o.mp_price_per_meal,
        };
        const { subtotal, total } = resolveCustomerMealPlanOrderDisplayTotals(o, planForPricing);
        let refundReview = null;
        if (o.status === 'cancelled') {
          try {
            refundReview = await getMealRefundReviewCustomerMetadata(String(o.id));
          } catch (refundErr: unknown) {
            console.warn(
              '[meal-plan-orders] refund review metadata skipped:',
              refundErr instanceof Error ? refundErr.message : refundErr
            );
          }
        }
        allOrders.push({
          id: o.id,
          order_number: o.order_number || o.id?.toString().slice(-8),
          order_type: 'meal_plan_delivery',
          orderType: 'meal_plan_delivery',
          meal_plan_id: o.meal_plan_id,
          meal_plan_name: o.meal_name || o.meal_plan_name || o.mp_plan_name,
          pet_id: o.pet_id,
          pet_name: o.pet_name,
          quantity: o.quantity,
          vendor_id: o.vendor_id,
          vendor_name: o.vendor_name,
          subscription_id: o.subscription_id ?? null,
          subtotal,
          total_amount: total,
          status: o.status,
          payment_status: o.payment_status,
          payment_hold_expires_at: o.payment_hold_expires_at ?? null,
          paymentHoldExpiresAt: o.payment_hold_expires_at ?? null,
          delivery_address: o.delivery_address,
          scheduled_delivery_date: o.scheduled_delivery_date,
          scheduled_delivery_slot: o.scheduled_delivery_slot,
          created_at: o.created_at,
          source: 'meal_orders',
          ...(refundReview ? { refundReview } : {}),
        });
      }

      // 2. From orders table (MealPlanBookingFlow /nutrition/delivery-orders)
      try {
        const hasOrderType = await customer_mealplanorders_getRepo.dbCustomerMealplanordersGet1().then((r: any) => (r?.rows?.length || 0) > 0);
        if (hasOrderType) {
          const ordResult = await customer_mealplanorders_getRepo.dbCustomerMealplanordersGet2(customerId).catch(() => ({ rows: [] }));

          for (const o of (ordResult as any).rows || []) {
            allOrders.push({
              id: o.id,
              order_number: o.order_number || o.id?.toString().slice(-8),
              order_type: 'meal_plan_delivery',
              orderType: 'meal_plan_delivery',
              meal_plan_id: o.meal_plan_id ?? null,
              meal_plan_name: o.meal_plan_name || 'Meal Plan',
              pet_id: null,
              pet_name: o.pet_name,
              quantity: o.line_quantity,
              vendor_id: o.vendor_id,
              vendor_name: o.vendor_name,
              total_amount: safeMoney(o.total_amount),
              status: o.status,
              delivery_address: o.delivery_address,
              scheduled_delivery_date: o.scheduled_delivery_date,
              scheduled_delivery_slot: o.scheduled_delivery_slot,
              created_at: o.created_at,
              source: 'orders',
            });
          }
        }
      } catch (_) {
        /* ignore */
      }

      // Sort by created_at desc
      allOrders.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

      try {
        await enrichSubscriptionRowsWithPresignedMealImages(allOrders);
      } catch (enrichErr: unknown) {
        console.warn(
          '[meal-plan-orders] image presign skipped:',
          enrichErr instanceof Error ? enrichErr.message : enrichErr
        );
      }

      return c.json({ success: true, orders: allOrders });
    } catch (error: any) {
      console.error('[meal-plan-orders] Error:', error);
      return c.json({ success: false, error: error?.message || 'Failed to load meal plan orders', orders: [] }, 500);
    }
}