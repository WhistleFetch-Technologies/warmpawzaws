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
import {
  calculateEcommerceSettlement,
  type EcommerceSettlementResult,
  type PromotionSource,
} from './ecommerce-settlement-calculator';

type OrderSettlementRow = {
  id: string;
  vendor_id: string;
  subtotal: number | string;
  tax_amount: number | string | null;
  shipping_amount: number | string | null;
  promotion_source: string | null;
  vendor_promotion_amount: number | string | null;
  admin_promotion_amount: number | string | null;
  commission_rate: number | string | null;
  commission_amount: number | string | null;
  metadata: unknown;
};

export type SettlementLedgerPayload = {
  vendorId: string;
  promotionId: string | null;
  promotionSource: PromotionSource;
  commissionRate: number;
  finalCommissionAmount: number;
  result: EcommerceSettlementResult;
};

export type SyncSettlementLedgerResult = {
  updated: boolean;
  skipped: boolean;
  reason?: string;
};

function buildSettlementFromOrderRow(order: OrderSettlementRow): SettlementLedgerPayload | null {
  if (!order?.vendor_id) return null;

  const metadata =
    typeof order.metadata === 'string'
      ? JSON.parse(order.metadata || '{}')
      : (order.metadata as Record<string, unknown>) || {};
  const promotionId = (metadata?.promotionId as string | undefined) || null;

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
  const commissionAmount =
    order.commission_amount != null ? Number(order.commission_amount) : undefined;

  const result = calculateEcommerceSettlement({
    merchandiseValue,
    taxableValue,
    commissionRate,
    promotionSource,
    discountAmount,
  });

  const finalCommissionAmount =
    promotionSource === 'vendor'
      ? result.commissionAmount
      : commissionAmount != null
        ? commissionAmount
        : result.commissionAmount;

  return {
    vendorId: String(order.vendor_id),
    promotionId,
    promotionSource,
    commissionRate,
    finalCommissionAmount,
    result,
  };
}

async function loadOrderForSettlement(orderId: string): Promise<OrderSettlementRow | null> {
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
  return (rows?.[0] as OrderSettlementRow | undefined) ?? null;
}

export async function writeEcommerceOrderSettlementLedgerRow(orderId: string): Promise<void> {
  try {
    const order = await loadOrderForSettlement(orderId);
    if (!order) return;

    const payload = buildSettlementFromOrderRow(order);
    if (!payload) return;

    const { vendorId, promotionId, promotionSource, commissionRate, finalCommissionAmount, result } =
      payload;

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
        vendorId,
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
    console.warn('[SETTLEMENT-LEDGER] writeEcommerceOrderSettlementLedgerRow skipped:', err);
  }
}

/** Update an existing ledger row after admin commission re-resolve. */
export async function syncEcommerceOrderSettlementLedgerRow(
  orderId: string,
  options?: { force?: boolean }
): Promise<SyncSettlementLedgerResult> {
  const force = options?.force ?? false;

  try {
    const ledgerRes = await query(
      `SELECT id, status FROM ecommerce_order_settlements WHERE order_id = $1::uuid LIMIT 1`,
      [orderId]
    );
    const ledger = ledgerRes.rows?.[0] as { id: string; status: string } | undefined;
    if (!ledger) {
      return { updated: false, skipped: true, reason: 'no_ledger_row' };
    }

    const status = String(ledger.status || '');
    if (status !== 'pending_batch' && !force) {
      return { updated: false, skipped: true, reason: `ledger_status_${status}` };
    }

    const order = await loadOrderForSettlement(orderId);
    if (!order) {
      return { updated: false, skipped: true, reason: 'order_not_found' };
    }

    const payload = buildSettlementFromOrderRow(order);
    if (!payload) {
      return { updated: false, skipped: true, reason: 'settlement_build_failed' };
    }

    const { commissionRate, finalCommissionAmount, result, promotionSource } = payload;

    let vendorPayoutAmount = result.vendorPayoutAmount;
    let platformNetAmount = result.platformNetAmount;
    if (finalCommissionAmount !== result.commissionAmount) {
      if (promotionSource === 'vendor') {
        vendorPayoutAmount = Math.max(0, result.customerPayableGoods - finalCommissionAmount);
        platformNetAmount = finalCommissionAmount;
      } else if (promotionSource === 'admin') {
        vendorPayoutAmount = Math.max(0, result.merchandiseValue - finalCommissionAmount);
        platformNetAmount = finalCommissionAmount - result.discountAmount;
      } else {
        vendorPayoutAmount = Math.max(0, result.merchandiseValue - finalCommissionAmount);
        platformNetAmount = finalCommissionAmount;
      }
    }

    await query(
      `UPDATE ecommerce_order_settlements SET
         commission_rate = $2,
         commission_amount = $3,
         vendor_payout_amount = $4,
         platform_net_amount = $5,
         updated_at = NOW()
       WHERE order_id = $1::uuid`,
      [
        orderId,
        commissionRate,
        finalCommissionAmount,
        vendorPayoutAmount,
        platformNetAmount,
      ]
    );

    return { updated: true, skipped: false };
  } catch (err) {
    console.warn('[SETTLEMENT-LEDGER] syncEcommerceOrderSettlementLedgerRow failed:', err);
    return { updated: false, skipped: true, reason: 'error' };
  }
}
