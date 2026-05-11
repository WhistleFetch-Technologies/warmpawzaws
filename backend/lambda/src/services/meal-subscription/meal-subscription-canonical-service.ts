/**
 * Canonical meal subscription creation + reads (P1).
 */

import type { PoolClient } from 'pg';
import { randomBytes } from 'crypto';
import { select, query, withTransaction } from '../../database/rds-connection';
import {
  parseMealCatalogDiet,
  normalizePurchaseType,
  normalizeCatalogDeliveryDaysArray,
  assertQuantityMatchesVendorMealsPreset,
} from '../../utils/meal-purchase-metadata';
import { resolveMealLineSubtotalInr } from '../../utils/meal-order-pricing';
import { computeMealSubscriptionCheckoutFees } from '../../utils/meal-subscription-checkout-fees';
import { deliveriesPerBillingCycle } from '../../utils/meal-subscription-schedule-utils';
import type { MealSubscriptionLifecycleStatus } from '../../constants/meal-subscription-canonical';
import { ensureRollingSessions, type SubscriptionRowForGeneration } from './meal-subscription-session-generation';

export type SubscriptionDeliveryScheduleInput = {
  weeklyPattern?: 'everyday' | 'weekdays_only' | 'alternate_days' | 'specific_weekdays' | 'weekly_default';
  weekdays?: string[];
  customerInstructions?: string;
  monthlyMode?: 'fixed_sessions' | 'recurring_monthly';
};

export type CreateCanonicalSubscriptionInput = {
  clientRequestKey: string;
  customerId?: string;
  customerPhone?: string;
  mealPlanId: string;
  purchaseType: 'WEEKLY_PLAN' | 'MONTHLY_PLAN';
  deliveryAddress: Record<string, unknown>;
  /** ISO date YYYY-MM-DD */
  firstDeliveryDate: string;
  deliveryTimeSlot: { start: string; end?: string };
  deliverySchedule?: SubscriptionDeliveryScheduleInput;
  totalSessions?: number | null;
  autoRenew?: boolean;
  paymentStatus?: 'paid' | 'pending';
  quantity?: number;
  petId?: string | null;
  /** Amount charged for initial period (optional audit row in meal_subscription_payments) */
  initialPaymentAmount?: number | null;
  razorpayPaymentId?: string | null;
  razorpayOrderId?: string | null;
};

function computeDeliveryDaysFromSchedule(s?: SubscriptionDeliveryScheduleInput): string[] {
  const p = s?.weeklyPattern;
  if (!p || p === 'weekly_default') {
    return ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  }
  if (p === 'everyday') return ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  if (p === 'weekdays_only') return ['mon', 'tue', 'wed', 'thu', 'fri'];
  if (p === 'alternate_days') return ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  if (p === 'specific_weekdays' && s.weekdays?.length) {
    return s.weekdays.map((w) => String(w).toLowerCase().slice(0, 3));
  }
  return ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
}

function shortSubscriptionNumber(): string {
  const s = `SUB${Date.now().toString(36)}${randomBytes(2).toString('hex')}`.toUpperCase();
  return s.slice(0, 20);
}

function recommendedSignupWeeksFromDiet(diet: Record<string, unknown>): number {
  const sub = diet.subscriptionConfig;
  const raw =
    diet.recommendedPlanLengthWeeks ??
    (typeof sub === 'object' && sub != null && !Array.isArray(sub)
      ? (sub as Record<string, unknown>).recommendedPlanLengthWeeks
      : undefined);
  const n = Number(raw);
  if (n === 1 || n === 2 || n === 4) return n;
  return 1;
}

async function resolveCustomerId(input: CreateCanonicalSubscriptionInput): Promise<string | null> {
  if (input.customerId && String(input.customerId).trim()) return String(input.customerId).trim();
  const raw = String(input.customerPhone || '').trim();
  if (!raw) return null;
  const cleanPhone = raw.replace(/\D/g, '').trim() || raw;
  let rows = await select('customers', { phone: cleanPhone }).catch(() => []);
  if (rows.length > 0) return rows[0].id as string;
  rows = await select('customers', { phone: raw }).catch(() => []);
  if (rows.length > 0) return rows[0].id as string;
  if (cleanPhone.length >= 10) {
    const without91 = cleanPhone.replace(/^91/, '');
    if (without91 !== cleanPhone) {
      rows = await select('customers', { phone: without91 }).catch(() => []);
      if (rows.length > 0) return rows[0].id as string;
    }
    const with91 = cleanPhone.length <= 10 ? `91${cleanPhone}` : cleanPhone;
    rows = await select('customers', { phone: with91 }).catch(() => []);
    if (rows.length > 0) return rows[0].id as string;
  }
  return null;
}

export async function findSubscriptionByClientRequestKey(
  clientRequestKey: string,
): Promise<Record<string, unknown> | null> {
  const r = await query(
    `SELECT * FROM meal_subscriptions WHERE client_request_key = $1 LIMIT 1`,
    [clientRequestKey],
  ).catch(() => ({ rows: [] }));
  return (r.rows?.[0] as Record<string, unknown>) || null;
}

export async function createCanonicalSubscription(
  input: CreateCanonicalSubscriptionInput,
): Promise<{ subscription: Record<string, unknown>; deliveriesInserted: number }> {
  const key = String(input.clientRequestKey || '').trim();
  if (!key || key.length < 8 || key.length > 192) {
    throw Object.assign(new Error('clientRequestKey is required (8–192 chars)'), { statusCode: 400 });
  }

  const existing = await findSubscriptionByClientRequestKey(key);
  if (existing) {
    return { subscription: existing, deliveriesInserted: 0 };
  }

  const customerId = await resolveCustomerId(input);
  if (!customerId) {
    throw Object.assign(new Error('customerId or valid customerPhone required'), { statusCode: 400 });
  }

  const plans = await select('meal_plans', { id: input.mealPlanId });
  if (!plans.length) {
    throw Object.assign(new Error('Meal plan not found'), { statusCode: 404 });
  }
  const plan = plans[0] as Record<string, unknown>;
  const diet = parseMealCatalogDiet(plan);
  const catalogPurchaseType = normalizePurchaseType(diet);
  if (catalogPurchaseType !== input.purchaseType) {
    throw Object.assign(
      new Error('purchaseType does not match meal catalog'),
      { statusCode: 400, code: 'PURCHASE_TYPE_MISMATCH', expected: catalogPurchaseType },
    );
  }

  const vendorId = plan.vendor_id as string;
  const qty = Math.max(1, Math.min(50, Number(input.quantity) || 1));
  assertQuantityMatchesVendorMealsPreset(diet, input.purchaseType, qty);

  const pricePerDelivery = resolveMealLineSubtotalInr({ subtotal: 0, quantity: qty }, plan);
  if (!pricePerDelivery || pricePerDelivery <= 0) {
    throw Object.assign(new Error('Meal plan has no valid price'), { statusCode: 400 });
  }

  const addrObj = input.deliveryAddress;
  const lat = addrObj.lat ?? addrObj.latitude;
  const lng = addrObj.lng ?? addrObj.longitude;

  const frequency = input.purchaseType === 'WEEKLY_PLAN' ? 'weekly' : 'monthly';
  const billingCycle = frequency;
  const lifecycle: MealSubscriptionLifecycleStatus =
    input.paymentStatus === 'pending' ? 'pending_payment' : 'active';
  const dbStatus =
    lifecycle === 'pending_payment' ? 'pending_payment' : 'active';

  const vendorWeeklyDayCodes = normalizeCatalogDeliveryDaysArray(diet.deliveryDays);

  let weeklyPatternResolved: SubscriptionDeliveryScheduleInput['weeklyPattern'] | undefined;
  let weekdaysResolved: string[] | undefined;

  if (input.purchaseType === 'WEEKLY_PLAN') {
    if (vendorWeeklyDayCodes.length > 0) {
      weeklyPatternResolved = 'specific_weekdays';
      const rawWd = input.deliverySchedule?.weekdays;
      if (!Array.isArray(rawWd) || rawWd.length === 0) {
        throw Object.assign(
          new Error('Choose at least one delivery day from the days this vendor offers'),
          { statusCode: 400 },
        );
      }
      const normalized = rawWd.map((x) => String(x).toLowerCase().slice(0, 3));
      const dedup: string[] = [];
      for (const d of normalized) {
        if (!vendorWeeklyDayCodes.includes(d)) {
          throw Object.assign(new Error(`This vendor does not deliver on ${d}`), { statusCode: 400 });
        }
        if (!dedup.includes(d)) dedup.push(d);
      }
      weekdaysResolved = dedup;
    } else {
      weeklyPatternResolved = input.deliverySchedule?.weeklyPattern ?? 'weekly_default';
      if (input.deliverySchedule?.weekdays?.length) {
        weekdaysResolved = input.deliverySchedule.weekdays.map((x) =>
          String(x).toLowerCase().slice(0, 3),
        );
      }
    }
  }

  const vendorMonthlyFreq =
    input.purchaseType === 'MONTHLY_PLAN'
      ? String(diet.deliveryFrequency || '').toUpperCase()
      : '';
  const monthlyFreqStored =
    vendorMonthlyFreq === 'DAILY' ||
    vendorMonthlyFreq === 'ALTERNATE_DAYS' ||
    vendorMonthlyFreq === 'TWICE_WEEKLY' ||
    vendorMonthlyFreq === 'WEEKLY'
      ? vendorMonthlyFreq
      : undefined;

  const deliveryScheduleJson = {
    cadence: frequency,
    slot: {
      start: input.deliveryTimeSlot.start,
      end: input.deliveryTimeSlot.end ?? input.deliveryTimeSlot.start,
    },
    source: 'canonical_v1',
    ...(weeklyPatternResolved ? { weeklyPattern: weeklyPatternResolved } : {}),
    ...(weekdaysResolved?.length ? { weekdays: weekdaysResolved } : {}),
    ...(monthlyFreqStored ? { monthlyDeliveryFrequency: monthlyFreqStored } : {}),
    ...(input.deliverySchedule?.customerInstructions
      ? { customerInstructions: input.deliverySchedule.customerInstructions }
      : {}),
    monthlyMode:
      input.purchaseType === 'MONTHLY_PLAN'
        ? input.deliverySchedule?.monthlyMode ?? 'recurring_monthly'
        : undefined,
  };

  const dietarySnapshot = { dietary_requirements: diet, meal_plan_id: input.mealPlanId };

  const scheduleForDpc = deliveryScheduleJson as Record<string, unknown>;
  const dpcDefault = Math.max(1, deliveriesPerBillingCycle(input.purchaseType, scheduleForDpc));
  const recWeeks = recommendedSignupWeeksFromDiet(diet);
  const suggestedSessions =
    input.purchaseType === 'WEEKLY_PLAN' ? recWeeks * dpcDefault : dpcDefault;

  const totalSessions =
    input.totalSessions != null && Number.isFinite(Number(input.totalSessions))
      ? Math.max(1, Math.min(500, Math.floor(Number(input.totalSessions))))
      : null;

  const remainingSessions = totalSessions;

  const feeQuote = await computeMealSubscriptionCheckoutFees({
    plan,
    vendorId,
    quantity: qty,
    purchaseType: input.purchaseType,
    schedule: scheduleForDpc,
    totalSessionsUsed: totalSessions ?? suggestedSessions,
    customerLat: lat != null ? Number(lat) : null,
    customerLng: lng != null ? Number(lng) : null,
    logisticsType: 'warmpawz',
  });

  const deliveryFeePerDelivery = feeQuote.perSessionDeliveryFee ?? 0;

  const pricingSnapshot = {
    pricePerDelivery,
    quantity: qty,
    currency: 'INR',
    mealPlanId: input.mealPlanId,
    deliveryFeePerSession: feeQuote.perSessionDeliveryFee,
    totalDeliveryFeeUpfront: feeQuote.totalDeliveryFeeUpfront,
    platformFeePerSession: feeQuote.platformFeePerSession,
    convenienceFeePerSession: feeQuote.convenienceFeePerSession,
    billingCycles: feeQuote.billingCycles,
    totalSessionsUsed: feeQuote.totalSessionsUsed,
    deliveriesPerBillingCycle: feeQuote.deliveriesPerBillingCycle,
    perSessionFoodSubtotal: feeQuote.perSessionFoodSubtotal,
    platformFeePerCycle: feeQuote.platformFeePerCycle,
    convenienceFeePerCycle: feeQuote.convenienceFeePerCycle,
    upfrontTotalAmount: feeQuote.upfrontTotalAmount,
  };

  const subscriptionNumber = shortSubscriptionNumber();
  const preferredSlotJson = JSON.stringify(deliveryScheduleJson.slot);
  const scheduleForDeliveryDays: SubscriptionDeliveryScheduleInput = {
    weeklyPattern: weeklyPatternResolved,
    weekdays: weekdaysResolved,
    monthlyMode: input.deliverySchedule?.monthlyMode,
    customerInstructions: input.deliverySchedule?.customerInstructions,
  };
  const deliveryDaysColumn = computeDeliveryDaysFromSchedule(scheduleForDeliveryDays);

  let deliveriesInserted = 0;

  try {
    const subscriptionRow = await withTransaction(async (client: PoolClient) => {
      const ins = await client.query(
        `INSERT INTO meal_subscriptions (
         subscription_number,
         customer_id,
         vendor_id,
         meal_plan_id,
         pet_id,
         frequency,
         meals_per_delivery,
         delivery_days,
         preferred_delivery_slot,
         delivery_address,
         customer_lat,
         customer_lng,
         price_per_delivery,
         delivery_fee_per_delivery,
         billing_cycle,
         next_billing_date,
         status,
         payment_method,
         start_date,
         end_date,
         purchase_type,
         lifecycle_status,
         total_sessions,
         completed_sessions,
         skipped_sessions,
         remaining_sessions,
         next_delivery_date,
         auto_renew,
         delivery_schedule_json,
         dietary_snapshot,
         pricing_snapshot,
         client_request_key,
         created_at,
         updated_at
       ) VALUES (
         $1, $2, $3, $4, $5,
         $6, $7, $8::varchar[], $9::jsonb,
         $10::jsonb, $11, $12,
         $13, $14,
         $15, $16::date,
         $17,
         'online',
         $16::date,
         NULL,
         $18,
         $19,
         $20,
         0, 0,
         $21,
         $16::date,
         $22,
         $23::jsonb,
         $24::jsonb,
         $25::jsonb,
         $26,
         NOW(),
         NOW()
       )
       RETURNING *`,
        [
          subscriptionNumber,
          customerId,
          vendorId,
          input.mealPlanId,
          input.petId || null,
          frequency,
          qty,
          deliveryDaysColumn,
          preferredSlotJson,
          JSON.stringify(addrObj),
          lat != null ? Number(lat) : null,
          lng != null ? Number(lng) : null,
          pricePerDelivery,
          deliveryFeePerDelivery,
          billingCycle,
          input.firstDeliveryDate,
          dbStatus,
          input.purchaseType,
          lifecycle,
          totalSessions,
          remainingSessions,
          input.autoRenew ?? false,
          JSON.stringify(deliveryScheduleJson),
          JSON.stringify(dietarySnapshot),
          JSON.stringify(pricingSnapshot),
          key,
        ],
      );

      const row = ins.rows[0] as Record<string, unknown>;
      const subId = row.id as string;

      if (
        input.initialPaymentAmount != null &&
        Number.isFinite(Number(input.initialPaymentAmount)) &&
        Number(input.initialPaymentAmount) > 0
      ) {
        await client.query(
          `INSERT INTO meal_subscription_payments (
             subscription_id, amount, currency, status, provider,
             provider_payment_id, provider_order_id, purpose, metadata
           ) VALUES ($1, $2, 'INR', $3, 'razorpay', $4, $5, 'initial', '{}'::jsonb)`,
          [
            subId,
            Number(input.initialPaymentAmount),
            input.paymentStatus === 'paid' ? 'paid' : 'pending',
            input.razorpayPaymentId,
            input.razorpayOrderId,
          ],
        );
      }

      if (lifecycle === 'active') {
        const gen = await ensureRollingSessions(client, row as unknown as SubscriptionRowForGeneration, {});
        deliveriesInserted = gen.inserted;
      }

      return row;
    });

    return { subscription: subscriptionRow, deliveriesInserted };
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err?.code === '23505') {
      const dup = await findSubscriptionByClientRequestKey(key);
      if (dup) return { subscription: dup, deliveriesInserted: 0 };
    }
    throw e;
  }
}

export async function getCanonicalSubscriptionForCustomer(
  subscriptionId: string,
  customerId: string,
): Promise<Record<string, unknown> | null> {
  const r = await query(
    `SELECT * FROM meal_subscriptions WHERE id = $1 AND customer_id = $2 LIMIT 1`,
    [subscriptionId, customerId],
  ).catch(() => ({ rows: [] }));
  return (r.rows?.[0] as Record<string, unknown>) || null;
}

export async function listCanonicalDeliveriesForCustomer(
  subscriptionId: string,
  customerId: string,
  limit: number,
  offset: number,
): Promise<{ rows: Record<string, unknown>[]; total: number }> {
  const own = await query(
    `SELECT 1 FROM meal_subscriptions WHERE id = $1 AND customer_id = $2`,
    [subscriptionId, customerId],
  ).catch(() => ({ rows: [] }));
  if (!own.rows?.length) {
    return { rows: [], total: 0 };
  }

  const cnt = await query(
    `SELECT COUNT(*)::int AS c FROM meal_subscription_deliveries WHERE subscription_id = $1`,
    [subscriptionId],
  ).catch(() => ({ rows: [{ c: 0 }] }));

  const list = await query(
    `SELECT * FROM meal_subscription_deliveries
     WHERE subscription_id = $1
     ORDER BY session_number ASC
     LIMIT $2 OFFSET $3`,
    [subscriptionId, Math.min(Math.max(limit, 1), 100), Math.max(offset, 0)],
  ).catch(() => ({ rows: [] }));

  return {
    rows: (list.rows || []) as Record<string, unknown>[],
    total: (cnt.rows?.[0]?.c as number) ?? 0,
  };
}

/** Batch rolling generation for active subscriptions (scheduler entrypoint). */
export async function runRollingSessionGenerationJob(options?: {
  horizonDays?: number;
  subscriptionId?: string;
}): Promise<{ processed: number; totalInserted: number }> {
  const horizonDays = options?.horizonDays;
  let subs: Record<string, unknown>[] = [];
  if (options?.subscriptionId) {
    const r = await query(`SELECT * FROM meal_subscriptions WHERE id = $1 AND lifecycle_status = 'active'`, [
      options.subscriptionId,
    ]).catch(() => ({ rows: [] }));
    subs = r.rows || [];
  } else {
    const r = await query(
      `SELECT * FROM meal_subscriptions
       WHERE lifecycle_status = 'active'
         AND purchase_type IN ('WEEKLY_PLAN', 'MONTHLY_PLAN')
       ORDER BY updated_at ASC
       LIMIT 200`,
      [],
    ).catch(() => ({ rows: [] }));
    subs = r.rows || [];
  }

  let processed = 0;
  let totalInserted = 0;

  for (const row of subs) {
    await withTransaction(async (client: PoolClient) => {
      const res = await ensureRollingSessions(
        client,
        row as unknown as SubscriptionRowForGeneration,
        { horizonDays },
      );
      totalInserted += res.inserted;
      processed += 1;
    }).catch((err) => {
      console.error('[meal-subscription-job] subscription', row.id, err);
    });
  }

  return { processed, totalInserted };
}
