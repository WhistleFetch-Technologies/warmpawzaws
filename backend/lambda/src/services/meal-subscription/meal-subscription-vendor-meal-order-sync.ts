/**
 * Mirrors canonical subscription sessions into meal_orders so vendor nutrition queues stay consistent with one-time checkout.
 */

import type { PoolClient } from 'pg';
import {
  asScheduleJson,
  deliveriesPerBillingCycle,
} from '../../utils/meal-subscription-schedule-utils';

function parseAddr(raw: unknown): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw === 'string') {
    try {
      const o = JSON.parse(raw) as unknown;
      return typeof o === 'object' && o != null && !Array.isArray(o) ? (o as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  return {};
}

function parsePricingSnap(raw: unknown): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw === 'string') {
    try {
      const o = JSON.parse(raw) as unknown;
      return typeof o === 'object' && o != null && !Array.isArray(o) ? (o as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  return {};
}

async function resolveSubscriptionParentMealOrderId(
  client: PoolClient,
  subscriptionId: string,
): Promise<string | null> {
  const r = await client.query(
    `SELECT id::text AS id FROM meal_orders
     WHERE subscription_id = $1::uuid
       AND purchase_snapshot IS NOT NULL
       AND (purchase_snapshot::jsonb->>'subscriptionVendorBookingRole') = 'parent'
     ORDER BY created_at ASC
     LIMIT 1`,
    [subscriptionId],
  );
  const id = r.rows?.[0]?.id as string | undefined;
  return id || null;
}

export async function upsertVendorMealOrderForCanonicalDelivery(
  client: PoolClient,
  params: {
    subscription: Record<string, unknown>;
    canonicalDeliveryId: string;
    sessionNumber: number;
    deliveryYmd: string;
    slot: Record<string, string>;
  },
): Promise<void> {
  const sub = params.subscription;
  const subId = String(sub.id || '');
  if (!subId || !params.canonicalDeliveryId) return;

  const cols = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'meal_orders'`,
  );
  const has = new Set((cols.rows || []).map((r: { column_name: string }) => r.column_name));

  /** Dedup without requiring purchase_snapshot (some DBs never ran migration 744). */
  const cidMarker = `__canonical_delivery_id__:${params.canonicalDeliveryId}__`;
  const specialInstructions = `${cidMarker} Subscription delivery · session ${params.sessionNumber}`;

  let dup;
  if (has.has('purchase_snapshot')) {
    dup = await client.query(
      `SELECT id FROM meal_orders
       WHERE subscription_id = $1::uuid
         AND (
           (purchase_snapshot IS NOT NULL AND purchase_snapshot->>'canonicalDeliveryId' = $2)
           OR special_instructions LIKE $3
         )
       LIMIT 1`,
      [subId, params.canonicalDeliveryId, `${cidMarker}%`],
    );
  } else {
    dup = await client.query(
      `SELECT id FROM meal_orders
       WHERE subscription_id = $1::uuid AND special_instructions LIKE $2
       LIMIT 1`,
      [subId, `${cidMarker}%`],
    );
  }
  if (dup.rows?.length) return;

  const purchaseType = String(sub.purchase_type || '').toUpperCase();
  const schedule = asScheduleJson(sub.delivery_schedule_json);
  const perCycleDeliveries = Math.max(1, deliveriesPerBillingCycle(purchaseType, schedule));

  const pkg = Number(sub.price_per_delivery || 0);
  const lineSubtotal = perCycleDeliveries > 0 ? Math.round((pkg / perCycleDeliveries) * 100) / 100 : Math.round(pkg * 100) / 100;

  const snap = parsePricingSnap(sub.pricing_snapshot);
  const deliveryFeePerSession =
    Number(sub.delivery_fee_per_delivery || snap.deliveryFeePerSession || snap.delivery_fee_per_session || 0) ||
    0;
  const platformFeePerSession = Number(snap.platformFeePerSession || snap.platform_fee_per_session || 0) || 0;
  const convenienceFeePerSession =
    Number(snap.convenienceFeePerSession || snap.convenience_fee_per_session || 0) || 0;
  const platformCombined = Math.round((platformFeePerSession + convenienceFeePerSession) * 100) / 100;
  const sessionDelivery = Math.round(deliveryFeePerSession * 100) / 100;
  const totalAmount = Math.round((lineSubtotal + sessionDelivery + platformCombined) * 100) / 100;

  const totalSessionsForPlan = Math.max(
    1,
    Number(sub.total_sessions) || perCycleDeliveries || 1,
  );

  const upfrontTotal =
    Number(snap.upfrontTotalAmount ?? snap.upfront_total_amount ?? 0) || 0;
  const foodUpfront =
    Number(snap.foodSubtotalUpfront ?? snap.food_subtotal_upfront ?? 0) || 0;
  const deliveryUpfront =
    Number(snap.totalDeliveryFeeUpfront ?? snap.total_delivery_fee_upfront ?? 0) || 0;
  const platformFeeUpfront =
    Number(snap.platformFeeUpfront ?? snap.platform_fee_upfront ?? 0) || 0;
  const convenienceFeeUpfront =
    Number(snap.convenienceFeeUpfront ?? snap.convenience_fee_upfront ?? 0) || 0;
  const platformCombinedUpfront =
    Math.round((platformFeeUpfront + convenienceFeeUpfront) * 100) / 100;

  const sessionTotalsFallback =
    Math.round(totalAmount * totalSessionsForPlan * 100) / 100;
  const parentGrandTotal =
    upfrontTotal > 0.009 ? Math.round(upfrontTotal * 100) / 100 : sessionTotalsFallback;
  const parentFood =
    foodUpfront > 0.009
      ? Math.round(foodUpfront * 100) / 100
      : Math.round(lineSubtotal * totalSessionsForPlan * 100) / 100;
  const parentDelivery =
    deliveryUpfront > 0.009
      ? Math.round(deliveryUpfront * 100) / 100
      : Math.round(sessionDelivery * totalSessionsForPlan * 100) / 100;
  const parentPlatform =
    platformCombinedUpfront > 0.009
      ? platformCombinedUpfront
      : Math.round(platformCombined * totalSessionsForPlan * 100) / 100;

  const logisticsType =
    String(sub.logistics_type || sub.logisticsType || 'warmpawz').trim() || 'warmpawz';

  const scheduleJson = asScheduleJson(sub.delivery_schedule_json);
  const monthlyDeliveryFrequency = String(
    scheduleJson.monthlyDeliveryFrequency || scheduleJson.monthly_delivery_frequency || '',
  ).toUpperCase();

  const addrObj = parseAddr(sub.delivery_address);
  const lat = sub.customer_lat ?? addrObj.lat ?? addrObj.latitude;
  const lng = sub.customer_lng ?? addrObj.lng ?? addrObj.longitude;

  const petId = sub.pet_id != null ? sub.pet_id : null;
  const qty = Math.max(1, Math.min(50, Number(sub.meals_per_delivery) || 1));

  const isParentSession = params.sessionNumber === 1;

  let purchaseSnap: Record<string, unknown>;

  if (isParentSession) {
    purchaseSnap = {
      canonicalDeliveryId: params.canonicalDeliveryId,
      sessionNumber: params.sessionNumber,
      source: 'canonical_meal_subscription',
      subscriptionVendorBookingRole: 'parent',
      subscriptionTotalSessions: totalSessionsForPlan,
      subscriptionPurchaseType: purchaseType,
      subscriptionCustomerPaidTotalInr: parentGrandTotal,
      subscriptionLogisticsType: logisticsType,
      ...(monthlyDeliveryFrequency
        ? { subscriptionMonthlyDeliveryFrequency: monthlyDeliveryFrequency }
        : {}),
    };
  } else {
    const parentMealOrderId = await resolveSubscriptionParentMealOrderId(client, subId);
    purchaseSnap = {
      canonicalDeliveryId: params.canonicalDeliveryId,
      sessionNumber: params.sessionNumber,
      source: 'canonical_meal_subscription',
      subscriptionTotalSessions: totalSessionsForPlan,
      subscriptionPurchaseType: purchaseType,
      subscriptionCustomerPaidTotalInr: parentGrandTotal,
      subscriptionLogisticsType: logisticsType,
      ...(monthlyDeliveryFrequency
        ? { subscriptionMonthlyDeliveryFrequency: monthlyDeliveryFrequency }
        : {}),
    };
    if (parentMealOrderId) {
      purchaseSnap.subscriptionVendorBookingRole = 'session';
      purchaseSnap.subscriptionVendorParentMealOrderId = parentMealOrderId;
    }
  }

  const row: Record<string, unknown> = {
    customer_id: sub.customer_id,
    vendor_id: sub.vendor_id,
    meal_plan_id: sub.meal_plan_id,
    subscription_id: sub.id,
    pet_id: petId,
    order_type: 'subscription',
    quantity: qty,
    special_instructions: specialInstructions,
    subtotal: isParentSession ? parentFood : lineSubtotal,
    delivery_fee: isParentSession ? parentDelivery : sessionDelivery,
    platform_fee: isParentSession ? parentPlatform : platformCombined,
    total_amount: isParentSession ? parentGrandTotal : totalAmount,
    delivery_address: JSON.stringify(addrObj),
    customer_lat: lat != null ? Number(lat) : null,
    customer_lng: lng != null ? Number(lng) : null,
    scheduled_delivery_date: params.deliveryYmd,
    scheduled_delivery_slot: JSON.stringify(params.slot),
    payment_status: 'paid',
    status: 'pending',
    logistics_type: logisticsType,
    logistics_cost: isParentSession ? parentDelivery : sessionDelivery,
    created_at: new Date(),
    updated_at: new Date(),
  };

  if (has.has('purchase_type')) row.purchase_type = purchaseType;
  if (has.has('purchase_snapshot')) row.purchase_snapshot = JSON.stringify(purchaseSnap);

  const keys = Object.keys(row).filter((k) => has.has(k));
  if (!keys.includes('customer_id') || !keys.includes('vendor_id')) return;

  const jsonbCols = new Set(['delivery_address', 'scheduled_delivery_slot', 'purchase_snapshot']);
  const placeholders = keys
    .map((k, i) => (jsonbCols.has(k) ? `$${i + 1}::jsonb` : `$${i + 1}`))
    .join(', ');
  const vals = keys.map((k) => row[k]);
  await client.query(
    `INSERT INTO meal_orders (${keys.join(', ')}) VALUES (${placeholders})`,
    vals,
  );
}
