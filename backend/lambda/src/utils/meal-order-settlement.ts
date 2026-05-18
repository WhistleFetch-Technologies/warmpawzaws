/**
 * Meal order vendor settlement — mirrors pharmacy hyperlocal logic (tier commission,
 * platform/convenience exclusions). Idempotent per meal_order_id.
 */
import { insert, query } from '../database/rds-connection';
import { syncCanonicalMealSubscriptionDeliveryWhenMealOrderDelivered } from './sync-canonical-delivery-from-meal-order';

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
    let orderAmount = parseFloat(order.total_amount);
    let deliveryFee = parseFloat(order.delivery_fee || '0');
    let platformFee = parseFloat(order.platform_fee || '0');
    let convenienceFee = parseFloat(order.convenience_fee || '0');
    let logisticsCost =
      order.logistics_type === 'warmpawz' ? parseFloat(order.logistics_cost || '0') : 0;

    if (isVendorSubscriptionParent) {
      const sessions = Math.max(1, Number(snap.subscriptionTotalSessions) || 1);
      const foodUpfront = parseFloat(String(order.subtotal ?? order.total_amount ?? '0'));
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
