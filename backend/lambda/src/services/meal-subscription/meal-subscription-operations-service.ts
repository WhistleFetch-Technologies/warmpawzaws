/**
 * Canonical meal subscription reads/writes beyond initial create:
 * customer list & lifecycle, delivery session ops, vendor queue & dispatch.
 */

import type { PoolClient } from 'pg';
import { query, withTransaction } from '../../database/rds-connection';
import { ensureRollingSessions, type SubscriptionRowForGeneration } from './meal-subscription-session-generation';
import { websocketService } from '../../lib/services/websocket-service';
import { presignMealPlanRowDisplayFields } from '../../utils/s3-media-presign';
import { debitCustomerWalletForMealSubscriptionInTransaction } from '../../utils/wallet-operations';
import { processMealSubscriptionSessionVendorCancelOriginalRefund } from '../../utils/payments/meal-order-original-refund';

export type MealSubscriptionLifecycleFilter =
  | 'all'
  | 'active'
  | 'paused'
  | 'completed'
  | 'expired'
  | 'cancelled'
  | 'pending_payment';

/**
 * When a canonical `meal_subscription_deliveries` row is rescheduled, mirrored `meal_orders` (vendor
 * nutrition queue + customer meal-plan list) must get the same `scheduled_delivery_date`.
 */
async function syncMirroredMealOrderDeliveryDateForCanonicalSession(options: {
  subscriptionId: string;
  canonicalDeliveryId: string;
  deliveryDateYmd: string;
}): Promise<void> {
  const subId = String(options.subscriptionId || '').trim();
  const cid = String(options.canonicalDeliveryId || '').trim();
  if (!subId || !cid || !/^\d{4}-\d{2}-\d{2}$/.test(options.deliveryDateYmd)) return;
  try {
    const snap = await query(
      `SELECT 1 AS ok FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'meal_orders' AND column_name = 'purchase_snapshot'
       LIMIT 1`,
    ).catch(() => ({ rows: [] as { ok: number }[] }));
    const hasPurchaseSnapshot = ((snap as { rows?: unknown[] }).rows?.length || 0) > 0;
    const likePat = `%__canonical_delivery_id__:${cid}__%`;

    if (hasPurchaseSnapshot) {
      await query(
        `UPDATE meal_orders mo
         SET scheduled_delivery_date = $1::date, updated_at = NOW()
         WHERE mo.subscription_id = $2::uuid
           AND (
             (mo.purchase_snapshot IS NOT NULL AND (mo.purchase_snapshot->>'canonicalDeliveryId') = $3)
             OR (mo.special_instructions IS NOT NULL AND mo.special_instructions LIKE $4)
           )`,
        [options.deliveryDateYmd, subId, cid, likePat],
      );
    } else {
      await query(
        `UPDATE meal_orders mo
         SET scheduled_delivery_date = $1::date, updated_at = NOW()
         WHERE mo.subscription_id = $2::uuid
           AND mo.special_instructions IS NOT NULL
           AND mo.special_instructions LIKE $3`,
        [options.deliveryDateYmd, subId, likePat],
      );
    }
  } catch (e) {
    console.warn('[meal-subscription] syncMirroredMealOrderDeliveryDateForCanonicalSession skipped:', e);
  }
}

/**
 * Idempotent: marks a canonical delivery delivered and bumps subscription session counters once.
 * Use when `meal_orders` mirrors a subscription session (`purchase_snapshot.canonicalDeliveryId`).
 */
export async function markMealSubscriptionDeliveryDeliveredById(
  deliveryId: string,
  subscriptionId?: string | null,
): Promise<boolean> {
  const sid = subscriptionId != null && String(subscriptionId).trim() ? String(subscriptionId).trim() : null;
  const sql = sid
    ? `UPDATE meal_subscription_deliveries SET
         status = 'delivered',
         delivered_at = COALESCE(delivered_at, NOW()),
         updated_at = NOW()
       WHERE id = $1 AND subscription_id = $2::uuid
         AND LOWER(COALESCE(status, '')) <> 'delivered'
       RETURNING subscription_id`
    : `UPDATE meal_subscription_deliveries SET
         status = 'delivered',
         delivered_at = COALESCE(delivered_at, NOW()),
         updated_at = NOW()
       WHERE id = $1
         AND LOWER(COALESCE(status, '')) <> 'delivered'
       RETURNING subscription_id`;
  const params = sid ? [deliveryId, sid] : [deliveryId];
  const r = await query(sql, params).catch(() => ({ rows: [] as { subscription_id: string }[] }));
  const subIdOut = r.rows?.[0]?.subscription_id;
  if (!subIdOut) return false;
  await query(
    `UPDATE meal_subscriptions SET
       completed_sessions = COALESCE(completed_sessions, 0) + 1,
       remaining_sessions = CASE WHEN remaining_sessions IS NOT NULL THEN GREATEST(0, remaining_sessions - 1) ELSE NULL END,
       updated_at = NOW()
     WHERE id = $1`,
    [subIdOut],
  );
  return true;
}

export async function listCanonicalSubscriptionsForCustomer(
  customerId: string,
  filter: MealSubscriptionLifecycleFilter = 'all',
): Promise<Record<string, unknown>[]> {
  let sql = `
    SELECT ms.*,
           mp.name AS meal_plan_name,
           COALESCE(
             CASE
               WHEN mp.dietary_requirements IS NOT NULL THEN
                 COALESCE(
                   mp.dietary_requirements::jsonb ->> 'mealImageUrl',
                   mp.dietary_requirements::jsonb ->> 'meal_image_url',
                   mp.dietary_requirements::jsonb ->> 'coverImageUrl',
                   mp.dietary_requirements::jsonb ->> 'imageUrl',
                   mp.dietary_requirements::jsonb ->> 'thumbnailUrl'
                 )
               ELSE NULL
             END,
             NULLIF(trim(mp.thumbnail_url::text), '')
           ) AS meal_plan_image_url,
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

/**
 * Resolve private S3 meal hero URLs to short-lived HTTPS for customer apps.
 */
export async function enrichSubscriptionRowsWithPresignedMealImages(
  rows: Record<string, unknown>[],
): Promise<void> {
  if (!rows.length) return;
  const ids = [
    ...new Set(
      rows
        .map((r) => (r.meal_plan_id != null ? String(r.meal_plan_id).trim() : ''))
        .filter((id) => id.length > 0),
    ),
  ];
  if (!ids.length) return;

  const res = await query(`SELECT * FROM meal_plans WHERE id = ANY($1::uuid[])`, [ids]).catch(() => ({
    rows: [] as Record<string, unknown>[],
  }));
  const byId = new Map<string, Record<string, unknown>>();
  for (const mp of res.rows || []) {
    const o = mp as Record<string, unknown>;
    if (o.id != null) byId.set(String(o.id), o);
  }

  for (const row of rows) {
    const mid = row.meal_plan_id != null ? String(row.meal_plan_id) : '';
    const mp = byId.get(mid);
    if (!mp) continue;
    try {
      const { mealImageUrl } = await presignMealPlanRowDisplayFields(mp);
      if (mealImageUrl) row.meal_plan_image_url = mealImageUrl;
    } catch (e) {
      console.warn('[meal-subscription] presign meal plan image skipped', mid, e);
    }
  }
}

export async function getCanonicalSubscriptionDetailForCustomer(
  subscriptionId: string,
  customerId: string,
): Promise<Record<string, unknown> | null> {
  const r = await query(
    `SELECT ms.*,
            mp.name AS meal_plan_name,
            COALESCE(
              CASE
                WHEN mp.dietary_requirements IS NOT NULL THEN
                  COALESCE(
                    mp.dietary_requirements::jsonb ->> 'mealImageUrl',
                    mp.dietary_requirements::jsonb ->> 'meal_image_url',
                    mp.dietary_requirements::jsonb ->> 'coverImageUrl',
                    mp.dietary_requirements::jsonb ->> 'imageUrl',
                    mp.dietary_requirements::jsonb ->> 'thumbnailUrl'
                  )
                ELSE NULL
              END,
              NULLIF(trim(mp.thumbnail_url::text), '')
            ) AS meal_plan_image_url,
            v.business_name AS vendor_name
     FROM meal_subscriptions ms
     LEFT JOIN meal_plans mp ON mp.id = ms.meal_plan_id
     LEFT JOIN vendors v ON v.id = ms.vendor_id
     WHERE ms.id = $1::uuid AND ms.customer_id = $2
     LIMIT 1`,
    [subscriptionId, customerId],
  ).catch(() => ({ rows: [] }));
  const row = (r.rows?.[0] as Record<string, unknown>) || null;
  if (!row) return null;
  await enrichSubscriptionRowsWithPresignedMealImages([row]);
  return row;
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

  let deliveriesToNotify: Record<string, unknown>[] = [];

  await withTransaction(async (client: PoolClient) => {
    const snapCol = await client.query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'meal_orders' AND column_name = 'purchase_snapshot'
       LIMIT 1`,
    );
    const hasPurchaseSnapshot = (snapCol.rowCount ?? 0) > 0;

    await client.query(
      `UPDATE meal_subscriptions SET
         lifecycle_status = 'paused',
         status = 'paused',
         pause_start = COALESCE(pause_start, CURRENT_DATE),
         updated_at = NOW()
       WHERE id = $1::uuid AND customer_id = $2`,
      [subscriptionId, customerId],
    );

    const pauseRes = await client.query(
      `UPDATE meal_subscription_deliveries SET
         pre_pause_delivery_status = status,
         status = 'paused',
         updated_at = NOW()
       WHERE subscription_id = $1::uuid
         AND status IN ('scheduled', 'preparing', 'ready', 'rescheduled')
       RETURNING *`,
      [subscriptionId],
    );
    deliveriesToNotify = (pauseRes.rows || []) as Record<string, unknown>[];

    const mealOrderPauseSql = hasPurchaseSnapshot
      ? `UPDATE meal_orders mo
       SET
         pre_pause_order_status = mo.status,
         status = 'paused',
         updated_at = NOW()
       WHERE mo.subscription_id = $1::uuid
         AND mo.status NOT IN ('delivered', 'cancelled', 'paused')
         AND (
           EXISTS (
             SELECT 1 FROM meal_subscription_deliveries d
             WHERE d.subscription_id = mo.subscription_id
               AND d.status = 'paused'
               AND mo.purchase_snapshot IS NOT NULL
               AND d.id::text = (mo.purchase_snapshot->>'canonicalDeliveryId')
           )
           OR EXISTS (
             SELECT 1 FROM meal_subscription_deliveries d
             WHERE d.subscription_id = mo.subscription_id
               AND d.status = 'paused'
               AND mo.special_instructions LIKE '%__canonical_delivery_id__:' || d.id::text || '__%'
           )
         )`
      : `UPDATE meal_orders mo
       SET
         pre_pause_order_status = mo.status,
         status = 'paused',
         updated_at = NOW()
       WHERE mo.subscription_id = $1::uuid
         AND mo.status NOT IN ('delivered', 'cancelled', 'paused')
         AND EXISTS (
           SELECT 1 FROM meal_subscription_deliveries d
           WHERE d.subscription_id = mo.subscription_id
             AND d.status = 'paused'
             AND mo.special_instructions LIKE '%__canonical_delivery_id__:' || d.id::text || '__%'
         )`;
    await client.query(mealOrderPauseSql, [subscriptionId]);
  });

  const r = await query(`SELECT * FROM meal_subscriptions WHERE id = $1`, [subscriptionId]);
  const subOut = (r.rows?.[0] as Record<string, unknown>) || null;
  if (subOut && deliveriesToNotify.length > 0) {
    for (const d of deliveriesToNotify) {
      await broadcastDeliveryUpdate(d, subOut, 'paused');
    }
  }
  return subOut;
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

  let resumedDeliveries: Record<string, unknown>[] = [];

  await withTransaction(async (client: PoolClient) => {
    const resDel = await client.query(
      `UPDATE meal_subscription_deliveries SET
         status = COALESCE(pre_pause_delivery_status, 'scheduled'),
         pre_pause_delivery_status = NULL,
         updated_at = NOW()
       WHERE subscription_id = $1::uuid AND status = 'paused'
       RETURNING *`,
      [subscriptionId],
    );
    resumedDeliveries = (resDel.rows || []) as Record<string, unknown>[];

    await client.query(
      `UPDATE meal_orders SET
         status = COALESCE(pre_pause_order_status, 'pending'),
         pre_pause_order_status = NULL,
         updated_at = NOW()
       WHERE subscription_id = $1::uuid AND status = 'paused'`,
      [subscriptionId],
    );

    await client.query(
      `UPDATE meal_subscriptions SET
         lifecycle_status = 'active',
         status = 'active',
         pause_end = CURRENT_DATE,
         updated_at = NOW()
       WHERE id = $1::uuid AND customer_id = $2`,
      [subscriptionId, customerId],
    );
    const rowRes = await client.query(`SELECT * FROM meal_subscriptions WHERE id = $1`, [subscriptionId]);
    const row = rowRes.rows[0] as Record<string, unknown>;
    await ensureRollingSessions(client, row as unknown as SubscriptionRowForGeneration, {});
  });

  const r = await query(`SELECT * FROM meal_subscriptions WHERE id = $1`, [subscriptionId]);
  const subOut = (r.rows?.[0] as Record<string, unknown>) || null;
  if (subOut && resumedDeliveries.length > 0) {
    for (const d of resumedDeliveries) {
      await broadcastDeliveryUpdate(d, subOut, String(d.status || 'scheduled'));
    }
  }
  return subOut;
}

/**
 * Debit Warmpawz wallet toward a pending_payment meal subscription (idempotent per idempotencyKey).
 * Updates the latest pending `meal_subscription_payments.metadata.wallet_debit_inr` (cumulative).
 */
export async function applyWalletDebitToPendingMealSubscription(
  subscriptionId: string,
  customerId: string,
  amountInRupees: number,
  idempotencyKey: string,
): Promise<{
  success: boolean;
  debited: number;
  remainderInRupees: number;
  balanceAfter?: number;
  error?: string;
}> {
  const sid = String(subscriptionId || '').trim();
  const cid = String(customerId || '').trim();
  const key = String(idempotencyKey || '').trim();
  if (!sid || !cid || !key) {
    return { success: false, debited: 0, remainderInRupees: 0, error: 'subscriptionId, customerId, idempotencyKey required' };
  }
  const req = Math.round(Number(amountInRupees) * 100) / 100;
  if (!Number.isFinite(req) || req <= 0) {
    return { success: false, debited: 0, remainderInRupees: 0, error: 'amountInRupees must be positive' };
  }

  const sub = await assertCustomerOwnsSubscription(sid, cid);
  if (!sub) return { success: false, debited: 0, remainderInRupees: 0, error: 'Subscription not found' };
  if (String(sub.lifecycle_status || '') !== 'pending_payment') {
    return { success: false, debited: 0, remainderInRupees: 0, error: 'Subscription is not awaiting payment' };
  }

  try {
    let debitedOut = 0;
    let balanceAfterOut: number | undefined;
    let pendingInvoiceTotal = 0;
    await withTransaction(async (client: PoolClient) => {
      const payRes = await client.query(
        `SELECT id, amount::text, COALESCE(metadata->>'wallet_debit_inr','0') AS wallet_applied
         FROM meal_subscription_payments
         WHERE subscription_id = $1::uuid AND status = 'pending'
         ORDER BY created_at DESC
         LIMIT 1
         FOR UPDATE`,
        [sid],
      );
      if (!payRes.rows?.length) {
        throw Object.assign(new Error('No pending payment row for subscription'), { statusCode: 400 });
      }
      const row = payRes.rows[0] as { id: string; amount: string; wallet_applied: string };
      const pendingAmount = parseFloat(String(row.amount ?? '0')) || 0;
      pendingInvoiceTotal = pendingAmount;
      const alreadyWallet = parseFloat(String(row.wallet_applied ?? '0')) || 0;
      const cap = Math.max(0, Math.round((pendingAmount - alreadyWallet) * 100) / 100);
      const debitAmount = Math.max(0, Math.min(req, cap));
      if (debitAmount <= 0) {
        debitedOut = 0;
        balanceAfterOut = undefined;
        return;
      }

      const { debited, balanceAfter } = await debitCustomerWalletForMealSubscriptionInTransaction(client, {
        customerId: cid,
        subscriptionId: sid,
        amount: debitAmount,
        idempotencyKey: key,
      });
      debitedOut = debited;
      balanceAfterOut = balanceAfter;

      const newWalletTotal = Math.round((alreadyWallet + debited) * 100) / 100;
      await client.query(
        `UPDATE meal_subscription_payments
         SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('wallet_debit_inr', $2::text),
             updated_at = NOW()
         WHERE id = $1::uuid`,
        [row.id, String(newWalletTotal)],
      );
    });

    const payAgain = await query(
      `SELECT amount::text AS amt, COALESCE(metadata->>'wallet_debit_inr','0') AS w FROM meal_subscription_payments
       WHERE subscription_id = $1::uuid AND status = 'pending' ORDER BY created_at DESC LIMIT 1`,
      [sid],
    );
    const inv = parseFloat(String(payAgain.rows?.[0]?.amt ?? pendingInvoiceTotal ?? '0')) || 0;
    const wtot = parseFloat(String(payAgain.rows?.[0]?.w ?? '0')) || 0;
    const remainder = Math.max(0, Math.round((inv - wtot) * 100) / 100);
    return { success: true, debited: debitedOut, remainderInRupees: remainder, balanceAfter: balanceAfterOut };
  } catch (e: unknown) {
    const err = e as { message?: string; statusCode?: number };
    return {
      success: false,
      debited: 0,
      remainderInRupees: 0,
      error: err.message || 'Wallet debit failed',
    };
  }
}

/** Attach Razorpay order id to the latest pending initial payment row (after wallet split). */
export async function setMealSubscriptionCheckoutRazorpayOrder(
  subscriptionId: string,
  customerId: string,
  razorpayOrderId: string,
): Promise<boolean> {
  const sid = String(subscriptionId || '').trim();
  const cid = String(customerId || '').trim();
  const oid = String(razorpayOrderId || '').trim();
  if (!sid || !cid || !oid) return false;
  const own = await assertCustomerOwnsSubscription(sid, cid);
  if (!own) return false;
  const r = await query(
    `UPDATE meal_subscription_payments msp
     SET provider_order_id = $3, updated_at = NOW()
     FROM meal_subscriptions ms
     WHERE msp.subscription_id = ms.id
       AND ms.id = $1::uuid
       AND ms.customer_id = $2::uuid
       AND msp.subscription_id = ms.id
       AND msp.status = 'pending'
       AND msp.purpose = 'initial'
     RETURNING msp.id`,
    [sid, cid, oid],
  );
  return (r.rows?.length || 0) > 0;
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
    await client.query(
      `UPDATE meal_subscription_payments SET
         status = 'paid',
         provider_payment_id = COALESCE($2::varchar, provider_payment_id, 'wallet'),
         updated_at = NOW()
       WHERE subscription_id = $1::uuid AND status = 'pending'`,
      [subscriptionId, razorpayPaymentId || null],
    );
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
  if (String(own.subscription.lifecycle_status || '') === 'paused') {
    throw Object.assign(new Error('Subscription is paused'), { statusCode: 400 });
  }
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
  if (String(own.subscription.lifecycle_status || '') === 'paused') {
    throw Object.assign(new Error('Subscription is paused — resume it to reschedule deliveries'), {
      statusCode: 400,
    });
  }
  const st = String(own.delivery.status || '');
  if (!['scheduled', 'preparing', 'rescheduled'].includes(st)) {
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
  const subId = String(own.subscription.id || '').trim();
  if (subId) {
    await syncMirroredMealOrderDeliveryDateForCanonicalSession({
      subscriptionId: subId,
      canonicalDeliveryId: deliveryId,
      deliveryDateYmd: newDeliveryDate,
    });
  }
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
  cancelReason?: string;
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

  const subLife = String(own.subscription.lifecycle_status || own.subscription.status || '');
  const dSt = String(own.delivery.status || '');
  if (subLife === 'paused' || dSt === 'paused') {
    throw Object.assign(new Error('Subscription or delivery is paused by the customer'), { statusCode: 400 });
  }

  // Cancel is only allowed on the first (parent) session
  if (options.status === 'cancelled') {
    const sessionNum = Number((own.delivery as Record<string, unknown>).session_number ?? 0);
    if (sessionNum !== 1) {
      throw Object.assign(
        new Error(
          'Individual Meal Plan sessions cannot be cancelled. Only the first session (parent) can be cancelled, which cancels the subscription.',
        ),
        { statusCode: 400 },
      );
    }
  }

  if (options.status === 'delivered') {
    await markMealSubscriptionDeliveryDeliveredById(
      options.deliveryId,
      own.subscription.id != null ? String(own.subscription.id) : null,
    );
  } else {
    const updates: string[] = ['status = $2', 'updated_at = NOW()'];
    const params: unknown[] = [options.deliveryId, options.status];
    await query(`UPDATE meal_subscription_deliveries SET ${updates.join(', ')} WHERE id = $1`, params);
  }

  const row = await vendorGetMealSubscriptionDelivery(vendorId, options.deliveryId);
  await broadcastDeliveryUpdate(row, own.subscription, options.status);

  // Trigger refund on vendor cancel of first session
  if (options.status === 'cancelled') {
    const subId = String(own.subscription.id || '');
    const sessionNum = Number((own.delivery as Record<string, unknown>).session_number ?? 1);
    const reason = options.cancelReason || 'Vendor cancelled the Meal Plan session';
    processMealSubscriptionSessionVendorCancelOriginalRefund(subId, options.deliveryId, sessionNum, reason).catch(
      (err: unknown) => {
        const e = err as { message?: string };
        console.error('[meal-ops] Refund failed after vendor cancel', e.message, {
          subId,
          deliveryId: options.deliveryId,
        });
      },
    );
  }

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
  const subLife = String(own.subscription.lifecycle_status || own.subscription.status || '');
  const st = String(own.delivery.status || '');
  if (subLife === 'paused' || st === 'paused') {
    throw Object.assign(new Error('Subscription is paused — dispatch is disabled until the customer resumes'), {
      statusCode: 400,
    });
  }
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
