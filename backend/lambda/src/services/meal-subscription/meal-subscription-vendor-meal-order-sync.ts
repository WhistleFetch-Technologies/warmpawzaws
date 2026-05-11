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

  const addrObj = parseAddr(sub.delivery_address);
  const lat = sub.customer_lat ?? addrObj.lat ?? addrObj.latitude;
  const lng = sub.customer_lng ?? addrObj.lng ?? addrObj.longitude;

  const petId = sub.pet_id != null ? sub.pet_id : null;
  const qty = Math.max(1, Math.min(50, Number(sub.meals_per_delivery) || 1));

  const snap = {
    canonicalDeliveryId: params.canonicalDeliveryId,
    sessionNumber: params.sessionNumber,
    source: 'canonical_meal_subscription',
  };

  const row: Record<string, unknown> = {
    customer_id: sub.customer_id,
    vendor_id: sub.vendor_id,
    meal_plan_id: sub.meal_plan_id,
    subscription_id: sub.id,
    pet_id: petId,
    order_type: 'subscription',
    quantity: qty,
    special_instructions: specialInstructions,
    subtotal: lineSubtotal,
    delivery_fee: 0,
    platform_fee: 0,
    total_amount: lineSubtotal,
    delivery_address: JSON.stringify(addrObj),
    customer_lat: lat != null ? Number(lat) : null,
    customer_lng: lng != null ? Number(lng) : null,
    scheduled_delivery_date: params.deliveryYmd,
    scheduled_delivery_slot: JSON.stringify(params.slot),
    payment_status: 'paid',
    status: 'pending',
    logistics_type: 'warmpawz',
    logistics_cost: 0,
    created_at: new Date(),
    updated_at: new Date(),
  };

  if (has.has('purchase_type')) row.purchase_type = purchaseType;
  if (has.has('purchase_snapshot')) row.purchase_snapshot = JSON.stringify(snap);

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
