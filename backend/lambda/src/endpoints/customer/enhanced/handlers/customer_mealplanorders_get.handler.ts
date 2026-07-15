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

export async function customerMealplanordersGetHandler(c: Context) {
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
        mealResult = await query(
          `SELECT mo.*,
                  COALESCE(NULLIF(TRIM(mp.name), ''), NULLIF(TRIM(mp.plan_name), '')) AS meal_plan_name,
                  mp.plan_name AS mp_plan_name,
                  mp.price_per_meal AS mp_price_per_meal,
                  mp.thumbnail_url AS mp_thumbnail_url,
                  v.business_name AS vendor_name,
                  p.name AS pet_name
           FROM meal_orders mo
           LEFT JOIN meal_plans mp ON mo.meal_plan_id = mp.id
           LEFT JOIN vendors v ON mo.vendor_id = v.id
           LEFT JOIN pets p ON mo.pet_id = p.id
           WHERE mo.customer_id = $1
           ORDER BY mo.created_at DESC`,
          [customerId]
        );
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
        const hasOrderType = await query(
          `SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'order_type' LIMIT 1`
        ).then((r: any) => (r?.rows?.length || 0) > 0);
        if (hasOrderType) {
          const ordResult = await query(
            `SELECT o.id, o.order_number, o.order_status as status, o.total_amount, o.shipping_address as delivery_address,
                    o.delivery_date as scheduled_delivery_date, o.delivery_time as scheduled_delivery_slot, o.created_at,
                    o.vendor_id, v.business_name as vendor_name,
                    (SELECT mp.name FROM meal_plan_orders mpo LEFT JOIN meal_plans mp ON mpo.meal_plan_id = mp.id WHERE mpo.order_id = o.id LIMIT 1) as meal_plan_name,
                    (SELECT mpo.meal_plan_id FROM meal_plan_orders mpo WHERE mpo.order_id = o.id LIMIT 1) as meal_plan_id,
                    (SELECT p.name FROM meal_plan_orders mpo LEFT JOIN pets p ON p.id = mpo.pet_id WHERE mpo.order_id = o.id LIMIT 1) as pet_name,
                    (SELECT mpo.quantity FROM meal_plan_orders mpo WHERE mpo.order_id = o.id LIMIT 1) as line_quantity
             FROM orders o
             LEFT JOIN vendors v ON o.vendor_id = v.id
             WHERE o.customer_id = $1 AND o.order_type = 'meal_plan_delivery'
             ORDER BY o.created_at DESC`,
            [customerId]
          ).catch(() => ({ rows: [] }));

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
