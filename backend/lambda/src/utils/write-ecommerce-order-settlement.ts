/**
 * Writes the per-order settlement ledger row (`ecommerce_order_settlements`) at
 * payment-verify time. This REPLACES the instant per-order Razorpay Route transfer
 * for e-commerce orders — money stays with WarmPawz until the periodic batch job
 * (ecommerce-settlement-processor.ts) pays vendors out via RazorpayX Payouts.
 *
 * Idempotent: `ecommerce_order_settlements.order_id` has a UNIQUE index, so this is
 * safe to call more than once for the same order (e.g. webhook + verify-payment both
 * firing) — the second call is a no-op.
 */

import { query } from '../database/rds-connection';
import { calculateEcommerceSettlement, type PromotionSource } from './ecommerce-settlement-calculator';

export async function writeEcommerceOrderSettlementLedgerRow(orderId: string): Promise<void> {
  try {
    const { rows } = await query(
      `SELECT
         o.id, o.vendor_id, o.subtotal, o.tax_amount, o.shipping_amount,
         o.discount_amount, o.promotion_source, o.vendor_promotion_amount,
         o.admin_promotion_amount, o.commission_rate, o.commission_amount,
         o.metadata
       FROM orders o
       WHERE o.id = $1::uuid
       LIMIT 1`,
      [orderId]
    );
    const order = rows?.[0];
    if (!order || !order.vendor_id) return;

    const metadata =
      typeof order.metadata === 'string'
        ? JSON.parse(order.metadata || '{}')
        : order.metadata || {};
    const promotionId = metadata?.promotionId || null;

    const promotionSource: PromotionSource =
      order.promotion_source === 'vendor' || order.promotion_source === 'admin'
        ? order.promotion_source
        : null;
    const discountAmount =
      promotionSource === 'vendor'
        ? Number(order.vendor_promotion_amount) || 0
        : promotionSource === 'admin'
          ? Number(order.admin_promotion_amount) || 0
          : 0;

    const merchandiseValue = Number(order.subtotal) || 0;
    const gstAmount = Number(order.tax_amount) || 0;
    const taxableValue = Math.max(0, merchandiseValue - gstAmount);
    const commissionRate = Number(order.commission_rate) || 0;
    const commissionAmount = order.commission_amount != null ? Number(order.commission_amount) : undefined;

    const result = calculateEcommerceSettlement({
      merchandiseValue,
      taxableValue,
      commissionRate,
      promotionSource,
      discountAmount,
    });

    // Prefer the commission actually stored on the order (audited at payment-verify) over
    // the recomputed one, in case the persisted commission_rate/amount predate this call.
    const finalCommissionAmount = commissionAmount != null ? commissionAmount : result.commissionAmount;

    await query(
      `INSERT INTO ecommerce_order_settlements (
         order_id, vendor_id, merchandise_value, taxable_value, gst_amount,
         commission_rate, commission_amount, promotion_source, promotion_id,
         discount_amount, shipping_amount, vendor_payout_amount, platform_net_amount, status
       ) VALUES (
         $1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9::uuid, $10, $11, $12, $13, 'pending_batch'
       )
       ON CONFLICT (order_id) DO NOTHING`,
      [
        orderId,
        order.vendor_id,
        result.merchandiseValue,
        result.taxableValue,
        result.gstAmount,
        commissionRate,
        finalCommissionAmount,
        promotionSource,
        promotionId,
        result.discountAmount,
        Number(order.shipping_amount) || 0,
        result.vendorPayoutAmount,
        result.platformNetAmount,
      ]
    );
  } catch (err) {
    // Never fail payment verification because of ledger bookkeeping — the batch job can
    // backfill from the orders table if a row is missing (see ecommerce-settlement-processor.ts).
    console.warn('[SETTLEMENT-LEDGER] writeEcommerceOrderSettlementLedgerRow skipped:', err);
  }
}
