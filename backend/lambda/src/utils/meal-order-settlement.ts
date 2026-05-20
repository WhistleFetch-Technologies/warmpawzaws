/**
 * Meal order vendor settlement — mirrors pharmacy hyperlocal logic (tier commission,
 * platform/convenience exclusions). Idempotent per meal_order_id.
 */
import { insert, query } from '../database/rds-connection';
import { syncCanonicalMealSubscriptionDeliveryWhenMealOrderDelivered } from './sync-canonical-delivery-from-meal-order';

function safeMoney(raw: unknown): number {
  if (raw === null || raw === undefined || raw === '') return 0;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function parseMealOrderPurchaseSnapshot(raw: unknown): Record<string, unknown> {
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

export async function ensureMealOrderSettlementOnDelivered(mealOrderId: string): Promise<void> {
  try {
    const orders = await query(`SELECT * FROM meal_orders WHERE id = $1`, [mealOrderId]);
    if (!orders.rows?.length) return;

    const order = orders.rows[0];
    if (String(order.status || '').toLowerCase() !== 'delivered') {
      return;
    }

    await syncCanonicalMealSubscriptionDeliveryWhenMealOrderDelivered(mealOrderId);

    const dup = await query(
      `SELECT id FROM delivery_settlements WHERE meal_order_id = $1 LIMIT 1`,
      [mealOrderId],
    ).catch(() => ({ rows: [] }));
    if (dup.rows?.length) return;

    const vendorId = order.vendor_id;

    const vendors = await query(
      `SELECT v.*, 
              v.commission_rate as vendor_commission_rate,
              vt.commission_rate as tier_commission_rate,
              vt.tier_name
       FROM vendors v 
       LEFT JOIN vendor_tiers vt ON vt.is_active = true 
         AND (TRIM(LOWER(v.tier)) = TRIM(LOWER(vt.tier_name)))
       WHERE v.id = $1`,
      [vendorId],
    );

    const vendor = vendors.rows?.[0];

    let commissionRate: number;
    if (vendor?.tier_commission_rate != null && !Number.isNaN(Number(vendor.tier_commission_rate))) {
      commissionRate = Number(vendor.tier_commission_rate);
    } else if (vendor?.vendor_commission_rate != null && !Number.isNaN(Number(vendor.vendor_commission_rate))) {
      commissionRate = Number(vendor.vendor_commission_rate);
    } else {
      commissionRate = 15.0;
    }

    const snap = parseMealOrderPurchaseSnapshot(order.purchase_snapshot);
    const isVendorSubscriptionParent = snap.subscriptionVendorBookingRole === 'parent';

    /** Parent row stores full customer checkout on total_amount; vendor commission uses meal (subtotal) only. */
    let orderAmount = safeMoney(order.total_amount);
    if (orderAmount <= 0) orderAmount = safeMoney(order.subtotal);
    if (orderAmount <= 0) {
      console.warn(`[meal-order-settlement] Skip settlement for ${mealOrderId}: no valid order amount`);
      return;
    }
    let deliveryFee = safeMoney(order.delivery_fee);
    let platformFee = safeMoney(order.platform_fee);
    let convenienceFee = safeMoney(order.convenience_fee);
    let logisticsCost =
      order.logistics_type === 'warmpawz' ? safeMoney(order.logistics_cost) : 0;

    if (isVendorSubscriptionParent) {
      const sessions = Math.max(1, Number(snap.subscriptionTotalSessions) || 1);
      const foodUpfront = safeMoney(order.subtotal ?? order.total_amount);
      if (foodUpfront <= 0) {
        console.warn(`[meal-order-settlement] Skip subscription parent settlement for ${mealOrderId}: no food upfront`);
        return;
      }
      orderAmount = Math.round((foodUpfront / sessions) * 100) / 100;
      deliveryFee = 0;
      platformFee = 0;
      convenienceFee = 0;
      logisticsCost = 0;
    }

    const commissionableAmount = orderAmount - deliveryFee - platformFee - convenienceFee;
    const commissionAmount = Math.round(commissionableAmount * (commissionRate / 100));
    const netPayout = orderAmount - commissionAmount - platformFee - convenienceFee - logisticsCost;

    await insert('delivery_settlements', {
      meal_order_id: mealOrderId,
      vendor_id: vendorId,
      order_amount: orderAmount,
      delivery_fee_collected: deliveryFee,
      platform_fee: platformFee,
      convenience_fee: convenienceFee,
      commission_rate: commissionRate,
      commission_amount: commissionAmount,
      logistics_cost: logisticsCost,
      net_payout: netPayout,
      status: 'pending',
      order_delivered_at: new Date().toISOString(),
      tier_name: vendor?.tier_name || null,
      tier_level: vendor?.tier_level || null,
    });

    console.log(
      `💰 Meal settlement created for order ${mealOrderId}: ₹${netPayout} (${commissionRate}% commission)`,
    );
  } catch (error) {
    console.error('[meal-order-settlement] Error creating settlement:', error);
  }
}

/** Create delivery_settlements rows for delivered meal orders that missed settlement (e.g. webhook txn rollback). */
export async function backfillMissingMealDeliverySettlementsForVendorIds(
  vendorIds: string[],
  logPrefix = '[MEAL-SETTLEMENT-BACKFILL]',
): Promise<void> {
  if (!vendorIds?.length) return;
  try {
    const missing = await query(
      `SELECT mo.id::text AS id
       FROM meal_orders mo
       LEFT JOIN delivery_settlements ds ON ds.meal_order_id = mo.id
       WHERE mo.vendor_id = ANY($1::uuid[])
         AND LOWER(mo.status) = 'delivered'
         AND ds.id IS NULL
       ORDER BY mo.delivered_at DESC NULLS LAST, mo.updated_at DESC
       LIMIT 50`,
      [vendorIds],
    );
    for (const row of missing.rows || []) {
      const id = String((row as { id?: string }).id || '');
      if (id) await ensureMealOrderSettlementOnDelivered(id);
    }
    if ((missing.rows || []).length > 0) {
      console.log(`${logPrefix} backfilled ${missing.rows.length} meal delivery_settlements`);
    }
  } catch (error) {
    console.error(`${logPrefix} failed:`, error);
  }
}

/** Align meal_orders.status with delivery_tracking when Pidge delivered webhook rolled back. */
export async function syncDeliveredMealOrdersFromTracking(vendorIds: string[]): Promise<void> {
  if (!vendorIds?.length) return;
  try {
    await query(
      `UPDATE meal_orders mo
       SET status = 'delivered',
           delivered_at = COALESCE(mo.delivered_at, dt.delivered_at, NOW()),
           updated_at = NOW()
       FROM delivery_tracking dt
       WHERE dt.meal_order_id = mo.id
         AND LOWER(dt.status) = 'delivered'
         AND LOWER(COALESCE(mo.status, '')) <> 'delivered'
         AND mo.vendor_id::text = ANY($1::text[])`,
      [vendorIds],
    );
  } catch (error) {
    console.warn('[meal-order-sync] syncDeliveredMealOrdersFromTracking failed:', error);
  }
}

const FINITE_NET_PAYOUT_SQL = `CASE
  WHEN net_payout IS NULL OR net_payout::text = 'NaN' THEN 0
  ELSE net_payout::numeric
END`;

/** Sum pending hyperlocal delivery settlements (meal + pharmacy) for payout availability. */
export async function sumPendingDeliverySettlementNetPayout(vendorIds: string[]): Promise<number> {
  if (!vendorIds?.length) return 0;
  try {
    const res = await query(
      `SELECT COALESCE(SUM(${FINITE_NET_PAYOUT_SQL}), 0) AS total
       FROM delivery_settlements
       WHERE vendor_id = ANY($1::uuid[]) AND LOWER(status) = 'pending'`,
      [vendorIds],
    );
    return safeMoney(res.rows?.[0]?.total);
  } catch (error) {
    console.warn('[delivery-settlement-payout] pending sum failed:', error);
    return 0;
  }
}

/** Sum transferred hyperlocal delivery settlements for paid-out totals. */
export async function sumTransferredDeliverySettlementNetPayout(vendorIds: string[]): Promise<number> {
  if (!vendorIds?.length) return 0;
  try {
    const res = await query(
      `SELECT COALESCE(SUM(${FINITE_NET_PAYOUT_SQL}), 0) AS total
       FROM delivery_settlements
       WHERE vendor_id = ANY($1::uuid[]) AND LOWER(status) = 'transferred'`,
      [vendorIds],
    );
    return safeMoney(res.rows?.[0]?.total);
  } catch (error) {
    console.warn('[delivery-settlement-payout] transferred sum failed:', error);
    return 0;
  }
}
