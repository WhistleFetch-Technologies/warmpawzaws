/**
 * Canonical meal subscription reads/writes beyond initial create:
 * customer list & lifecycle, delivery session ops, vendor queue & dispatch.
 */

import type { PoolClient } from 'pg';
import { query, withTransaction } from '../../database/rds-connection';
import { ensureRollingSessions, type SubscriptionRowForGeneration } from './meal-subscription-session-generation';
import { websocketService } from '../../lib/services/websocket-service';

export type MealSubscriptionLifecycleFilter =
  | 'all'
  | 'active'
  | 'paused'
  | 'completed'
  | 'expired'
  | 'cancelled'
  | 'pending_payment';

export async function listCanonicalSubscriptionsForCustomer(
  customerId: string,
  filter: MealSubscriptionLifecycleFilter = 'all',
): Promise<Record<string, unknown>[]> {
  let sql = `
    SELECT ms.*,
           mp.name AS meal_plan_name,
           CASE
             WHEN mp.dietary_requirements IS NOT NULL THEN
               COALESCE(
                 mp.dietary_requirements::jsonb ->> 'mealImageUrl',
                 mp.dietary_requirements::jsonb ->> 'meal_image_url'
               )
             ELSE NULL
           END AS meal_plan_image_url,
           v.business_name AS vendor_name
    FROM meal_subscriptions ms
    LEFT JOIN meal_plans mp ON mp.id = ms.meal_plan_id
    LEFT JOIN vendors v ON v.id = ms.vendor_id
    WHERE ms.customer_id = $1
      AND ms.purchase_type IN ('WEEKLY_PLAN', 'MONTHLY_PLAN')
  `;
  const params: string[] = [customerId];
  if (filter !== 'all') {
    sql += ` AND ms.lifecycle_status = $2`;
    params.push(filter);
  }
  sql += ` ORDER BY ms.created_at DESC`;
  const r = await query(sql, params).catch(() => ({ rows: [] }));
  return (r.rows || []) as Record<string, unknown>[];
}

async function assertCustomerOwnsSubscription(
  subscriptionId: string,
  customerId: string,
): Promise<Record<string, unknown> | null> {
  const r = await query(`SELECT * FROM meal_subscriptions WHERE id = $1 AND customer_id = $2`, [
    subscriptionId,
    customerId,
  ]).catch(() => ({ rows: [] }));
  return (r.rows?.[0] as Record<string, unknown>) || null;
}

export async function pauseCanonicalSubscription(
  subscriptionId: string,
  customerId: string,
): Promise<Record<string, unknown> | null> {
  const sub = await assertCustomerOwnsSubscription(subscriptionId, customerId);
  if (!sub) return null;
  if (sub.lifecycle_status !== 'active') {
    throw Object.assign(new Error('Only active subscriptions can be paused'), { statusCode: 400 });
  }
  await query(
    `UPDATE meal_subscriptions SET
       lifecycle_status = 'paused',
       status = 'paused',
       pause_start = COALESCE(pause_start, CURRENT_DATE),
       updated_at = NOW()
     WHERE id = $1 AND customer_id = $2`,
    [subscriptionId, customerId],
  );
  const r = await query(`SELECT * FROM meal_subscriptions WHERE id = $1`, [subscriptionId]);
  return (r.rows?.[0] as Record<string, unknown>) || null;
}

export async function resumeCanonicalSubscription(
  subscriptionId: string,
  customerId: string,
): Promise<Record<string, unknown> | null> {
  const sub = await assertCustomerOwnsSubscription(subscriptionId, customerId);
  if (!sub) return null;
  if (sub.lifecycle_status !== 'paused') {
    throw Object.assign(new Error('Only paused subscriptions can be resumed'), { statusCode: 400 });
  }
  await withTransaction(async (client: PoolClient) => {
    await client.query(
      `UPDATE meal_subscriptions SET
         lifecycle_status = 'active',
         status = 'active',
         pause_end = CURRENT_DATE,
         updated_at = NOW()
       WHERE id = $1 AND customer_id = $2`,
      [subscriptionId, customerId],
    );
    const rowRes = await client.query(`SELECT * FROM meal_subscriptions WHERE id = $1`, [subscriptionId]);
    const row = rowRes.rows[0] as Record<string, unknown>;
    await ensureRollingSessions(client, row as unknown as SubscriptionRowForGeneration, {});
  });
  const r = await query(`SELECT * FROM meal_subscriptions WHERE id = $1`, [subscriptionId]);
  return (r.rows?.[0] as Record<string, unknown>) || null;
}

export async function activateCanonicalSubscriptionAfterPayment(
  subscriptionId: string,
  customerId: string,
  razorpayPaymentId?: string | null,
): Promise<Record<string, unknown> | null> {
  const sub = await assertCustomerOwnsSubscription(subscriptionId, customerId);
  if (!sub) return null;
  if (sub.lifecycle_status !== 'pending_payment') {
    throw Object.assign(new Error('Subscription is not awaiting payment'), { statusCode: 400 });
  }

  await withTransaction(async (client: PoolClient) => {
    await client.query(
      `UPDATE meal_subscriptions SET
         lifecycle_status = 'active',
         status = 'active',
         updated_at = NOW()
       WHERE id = $1 AND customer_id = $2`,
      [subscriptionId, customerId],
    );
    if (razorpayPaymentId) {
      await client.query(
        `UPDATE meal_subscription_payments SET status = 'paid', provider_payment_id = COALESCE(provider_payment_id, $2), updated_at = NOW()
         WHERE subscription_id = $1`,
        [subscriptionId, razorpayPaymentId],
      );
    }
    const rowRes = await client.query(`SELECT * FROM meal_subscriptions WHERE id = $1`, [subscriptionId]);
    const row = rowRes.rows[0] as Record<string, unknown>;
    await ensureRollingSessions(client, row as unknown as SubscriptionRowForGeneration, {});
  });

  const r = await query(`SELECT * FROM meal_subscriptions WHERE id = $1`, [subscriptionId]);
  return (r.rows?.[0] as Record<string, unknown>) || null;
}

async function assertCustomerOwnsDelivery(
  deliveryId: string,
  customerId: string,
): Promise<{ delivery: Record<string, unknown>; subscription: Record<string, unknown> } | null> {
  const r = await query(
    `SELECT d.*
     FROM meal_subscription_deliveries d
     INNER JOIN meal_subscriptions s ON s.id = d.subscription_id
     WHERE d.id = $1 AND s.customer_id = $2`,
    [deliveryId, customerId],
  ).catch(() => ({ rows: [] }));
  const delivery = r.rows?.[0] as Record<string, unknown> | undefined;
  if (!delivery?.subscription_id) return null;
  const sub = await query(`SELECT * FROM meal_subscriptions WHERE id = $1`, [delivery.subscription_id]);
  const subscription = sub.rows?.[0] as Record<string, unknown> | undefined;
  if (!subscription) return null;
  return { delivery, subscription };
}

export async function skipCanonicalDeliverySession(
  deliveryId: string,
  customerId: string,
  reason?: string,
): Promise<Record<string, unknown> | null> {
  const own = await assertCustomerOwnsDelivery(deliveryId, customerId);
  if (!own) return null;
  const st = String(own.delivery.status || '');
  if (!['scheduled', 'preparing'].includes(st)) {
    throw Object.assign(new Error('This delivery cannot be skipped'), { statusCode: 400 });
  }
  await query(
    `UPDATE meal_subscription_deliveries SET
       status = 'skipped',
       skipped_reason = $2,
       updated_at = NOW()
     WHERE id = $1`,
    [deliveryId, reason || 'customer_skip'],
  );
  await query(
    `UPDATE meal_subscriptions SET
       skipped_sessions = COALESCE(skipped_sessions, 0) + 1,
       remaining_sessions = CASE WHEN remaining_sessions IS NOT NULL THEN GREATEST(0, remaining_sessions - 1) ELSE NULL END,
       updated_at = NOW()
     WHERE id = $1`,
    [own.subscription.id],
  );
  const out = await query(`SELECT * FROM meal_subscription_deliveries WHERE id = $1`, [deliveryId]);
  const drow = out.rows?.[0] as Record<string, unknown>;
  await broadcastDeliveryUpdate(drow, own.subscription, 'skipped');
  return drow || null;
}

export async function rescheduleCanonicalDeliverySession(
  deliveryId: string,
  customerId: string,
  newDeliveryDate: string,
): Promise<Record<string, unknown> | null> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(newDeliveryDate)) {
    throw Object.assign(new Error('newDeliveryDate must be YYYY-MM-DD'), { statusCode: 400 });
  }
  const own = await assertCustomerOwnsDelivery(deliveryId, customerId);
  if (!own) return null;
  const st = String(own.delivery.status || '');
  if (!['scheduled', 'preparing'].includes(st)) {
    throw Object.assign(new Error('This delivery cannot be rescheduled'), { statusCode: 400 });
  }
  await query(
    `UPDATE meal_subscription_deliveries SET
       delivery_date = $2::date,
       status = 'rescheduled',
       updated_at = NOW()
     WHERE id = $1`,
    [deliveryId, newDeliveryDate],
  );
  const out = await query(`SELECT * FROM meal_subscription_deliveries WHERE id = $1`, [deliveryId]);
  const drow = out.rows?.[0] as Record<string, unknown>;
  await broadcastDeliveryUpdate(drow, own.subscription, 'rescheduled');
  return drow || null;
}

function vendorHeaderVendorId(vendorIdPath: string, headerVendor?: string): string | null {
  if (!vendorIdPath) return null;
  if (headerVendor && headerVendor !== vendorIdPath) return null;
  return vendorIdPath;
}

async function assertVendorOwnsDelivery(
  vendorId: string,
  deliveryId: string,
): Promise<{ delivery: Record<string, unknown>; subscription: Record<string, unknown> } | null> {
  const r = await query(
    `SELECT d.*, s.vendor_id
     FROM meal_subscription_deliveries d
     INNER JOIN meal_subscriptions s ON s.id = d.subscription_id
     WHERE d.id = $1 AND s.vendor_id = $2`,
    [deliveryId, vendorId],
  ).catch(() => ({ rows: [] }));
  const row = r.rows?.[0];
  if (!row) return null;
  const sub = await query(`SELECT * FROM meal_subscriptions WHERE id = $1`, [row.subscription_id]);
  return {
    delivery: row as Record<string, unknown>,
    subscription: (sub.rows?.[0] as Record<string, unknown>) || {},
  };
}

export async function vendorListMealSubscriptionDeliveries(options: {
  vendorId: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ rows: Record<string, unknown>[]; total: number }> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
  const offset = Math.max(options.offset ?? 0, 0);
  const params: unknown[] = [options.vendorId];
  let where = `WHERE s.vendor_id = $1`;
  if (options.dateFrom && /^\d{4}-\d{2}-\d{2}$/.test(options.dateFrom)) {
    params.push(options.dateFrom);
    where += ` AND d.delivery_date >= $${params.length}::date`;
  }
  if (options.dateTo && /^\d{4}-\d{2}-\d{2}$/.test(options.dateTo)) {
    params.push(options.dateTo);
    where += ` AND d.delivery_date <= $${params.length}::date`;
  }
  if (options.status && options.status !== 'all') {
    const st = options.status === 'dispatched' ? 'out_for_delivery' : options.status;
    params.push(st);
    where += ` AND d.status = $${params.length}`;
  }

  const cnt = await query(
    `SELECT COUNT(*)::int AS c
     FROM meal_subscription_deliveries d
     INNER JOIN meal_subscriptions s ON s.id = d.subscription_id
     ${where}`,
    params,
  ).catch(() => ({ rows: [{ c: 0 }] }));

  const listParams = [...params, limit, offset];
  const list = await query(
    `SELECT d.*,
            s.customer_id,
            s.meal_plan_id,
            s.meals_per_delivery,
            s.delivery_address,
            s.subscription_number,
            s.purchase_type,
            s.lifecycle_status AS subscription_lifecycle,
            mp.name AS meal_plan_name,
            c.full_name AS customer_name,
            c.phone AS customer_phone
     FROM meal_subscription_deliveries d
     INNER JOIN meal_subscriptions s ON s.id = d.subscription_id
     LEFT JOIN meal_plans mp ON mp.id = s.meal_plan_id
     LEFT JOIN customers c ON c.id = s.customer_id
     ${where}
     ORDER BY d.delivery_date ASC, d.session_number ASC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    listParams,
  ).catch(() => ({ rows: [] }));

  return {
    rows: (list.rows || []) as Record<string, unknown>[],
    total: (cnt.rows?.[0]?.c as number) ?? 0,
  };
}

export async function vendorGetMealSubscriptionDelivery(
  vendorId: string,
  deliveryId: string,
): Promise<Record<string, unknown> | null> {
  const r = await query(
    `SELECT d.*,
            s.customer_id,
            s.meal_plan_id,
            s.meals_per_delivery,
            s.delivery_address,
            s.delivery_schedule_json,
            s.dietary_snapshot,
            s.subscription_number,
            s.purchase_type,
            s.total_sessions,
            s.completed_sessions,
            s.skipped_sessions,
            s.remaining_sessions,
            s.lifecycle_status,
            mp.name AS meal_plan_name,
            c.full_name AS customer_name,
            c.phone AS customer_phone,
            c.email AS customer_email
     FROM meal_subscription_deliveries d
     INNER JOIN meal_subscriptions s ON s.id = d.subscription_id
     LEFT JOIN meal_plans mp ON mp.id = s.meal_plan_id
     LEFT JOIN customers c ON c.id = s.customer_id
     WHERE d.id = $1 AND s.vendor_id = $2`,
    [deliveryId, vendorId],
  ).catch(() => ({ rows: [] }));
  return (r.rows?.[0] as Record<string, unknown>) || null;
}

const VENDOR_ALLOWED_STATUSES = [
  'preparing',
  'ready',
  'assigned',
  'out_for_delivery',
  'delivered',
  'skipped',
  'cancelled',
  'failed',
] as const;

export async function vendorUpdateMealSubscriptionDeliveryStatus(options: {
  vendorIdFromPath: string;
  headerVendorId?: string;
  deliveryId: string;
  status: string;
}): Promise<Record<string, unknown> | null> {
  const vendorId = vendorHeaderVendorId(options.vendorIdFromPath, options.headerVendorId);
  if (!vendorId) {
    throw Object.assign(new Error('Vendor mismatch'), { statusCode: 403 });
  }
  if (!VENDOR_ALLOWED_STATUSES.includes(options.status as (typeof VENDOR_ALLOWED_STATUSES)[number])) {
    throw Object.assign(new Error('Invalid status'), { statusCode: 400 });
  }
  const own = await assertVendorOwnsDelivery(vendorId, options.deliveryId);
  if (!own) return null;

  const updates: string[] = ['status = $2', 'updated_at = NOW()'];
  const params: unknown[] = [options.deliveryId, options.status];
  if (options.status === 'delivered') {
    updates.push(`delivered_at = NOW()`);
  }

  await query(`UPDATE meal_subscription_deliveries SET ${updates.join(', ')} WHERE id = $1`, params);

  if (options.status === 'delivered') {
    await query(
      `UPDATE meal_subscriptions SET
         completed_sessions = COALESCE(completed_sessions, 0) + 1,
         remaining_sessions = CASE WHEN remaining_sessions IS NOT NULL THEN GREATEST(0, remaining_sessions - 1) ELSE NULL END,
         updated_at = NOW()
       WHERE id = $1`,
      [own.subscription.id],
    );
  }

  const row = await vendorGetMealSubscriptionDelivery(vendorId, options.deliveryId);
  await broadcastDeliveryUpdate(row, own.subscription, options.status);
  return row;
}

/**
 * Dispatch scaffolding: marks session ready for logistics handoff (Pidge integration later).
 */
export async function vendorDispatchMealSubscriptionDelivery(options: {
  vendorIdFromPath: string;
  headerVendorId?: string;
  deliveryId: string;
  notes?: string;
}): Promise<Record<string, unknown> | null> {
  const vendorId = vendorHeaderVendorId(options.vendorIdFromPath, options.headerVendorId);
  if (!vendorId) {
    throw Object.assign(new Error('Vendor mismatch'), { statusCode: 403 });
  }
  const own = await assertVendorOwnsDelivery(vendorId, options.deliveryId);
  if (!own) return null;
  const st = String(own.delivery.status || '');
  if (!['ready', 'preparing', 'scheduled'].includes(st)) {
    throw Object.assign(new Error('Delivery must be preparing or ready to dispatch'), { statusCode: 400 });
  }

  await query(
    `UPDATE meal_subscription_deliveries SET
       status = 'out_for_delivery',
       vendor_notes = COALESCE($2, vendor_notes),
       updated_at = NOW()
     WHERE id = $1`,
    [options.deliveryId, options.notes || null],
  );

  const row = await vendorGetMealSubscriptionDelivery(vendorId, options.deliveryId);
  await broadcastDeliveryUpdate(row, own.subscription, 'out_for_delivery');
  return row;
}

async function broadcastDeliveryUpdate(
  delivery: Record<string, unknown> | null | undefined,
  subscription: Record<string, unknown>,
  status: string,
): Promise<void> {
  if (!delivery?.id) return;
  const customerId = String(subscription.customer_id || '');
  const vendorId = String(subscription.vendor_id || '');
  const payload = {
    mealSubscriptionDeliveryId: delivery.id,
    subscriptionId: subscription.id,
    status,
    delivery,
    subscription,
    timestamp: new Date().toISOString(),
  };
  try {
    await websocketService.sendMealSubscriptionDeliveryUpdate(customerId, vendorId, payload);
  } catch (e) {
    console.warn('[meal-subscription] websocket notify failed', e);
  }
}

export async function vendorListCanonicalSubscriptionsOverview(vendorId: string): Promise<Record<string, unknown>[]> {
  const r = await query(
    `SELECT ms.*, mp.name AS meal_plan_name
     FROM meal_subscriptions ms
     LEFT JOIN meal_plans mp ON mp.id = ms.meal_plan_id
     WHERE ms.vendor_id = $1
       AND ms.purchase_type IN ('WEEKLY_PLAN', 'MONTHLY_PLAN')
     ORDER BY ms.updated_at DESC
     LIMIT 100`,
    [vendorId],
  ).catch(() => ({ rows: [] }));
  return (r.rows || []) as Record<string, unknown>[];
}
