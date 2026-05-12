/**
 * Meal order vendor settlement — mirrors pharmacy hyperlocal logic (tier commission,
 * platform/convenience exclusions). Idempotent per meal_order_id.
 */
import { insert, query } from '../database/rds-connection';
import { syncCanonicalMealSubscriptionDeliveryWhenMealOrderDelivered } from './sync-canonical-delivery-from-meal-order';

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

    const orderAmount = parseFloat(order.total_amount);
    const deliveryFee = parseFloat(order.delivery_fee || '0');
    const platformFee = parseFloat(order.platform_fee || '0');
    const convenienceFee = parseFloat(order.convenience_fee || '0');
    const logisticsCost =
      order.logistics_type === 'warmpawz' ? parseFloat(order.logistics_cost || '0') : 0;

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
