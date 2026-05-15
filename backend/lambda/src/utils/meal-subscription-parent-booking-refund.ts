/**
 * Vendor cancels subscription parent booking before preparation:
 * customer is refunded meal + delivery + convenience + GST (everything charged except platform fee).
 * Platform fee (upfront) is withheld per policy; refund is split wallet / Razorpay in proportion to the original payment.
 */

import { query, withTransaction } from '../database/rds-connection';
import { getRazorpayClient } from './payments/razorpay-client';
import type { MealSessionRefundResult } from './meal-subscription-refund';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function parsePricingSnapshot(raw: unknown): Record<string, unknown> {
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

export async function processSubscriptionVendorParentBookingFullRefund(
  subscriptionId: string,
  cancelReason: string,
): Promise<MealSessionRefundResult> {
  const payRes = await query(
    `SELECT id, amount::text, provider_payment_id, provider,
            COALESCE(metadata->>'wallet_debit_inr', '0') AS wallet_debit_inr,
            COALESCE(metadata->>'vendor_parent_booking_full_refund_at', '') AS refund_done_at
     FROM meal_subscription_payments
     WHERE subscription_id = $1::uuid AND status = 'paid'
     ORDER BY created_at DESC LIMIT 1`,
    [subscriptionId],
  ).catch(() => ({ rows: [] }));

  const pay = payRes.rows?.[0] as
    | {
        id: string;
        amount: string;
        provider_payment_id?: string;
        provider?: string;
        wallet_debit_inr: string;
        refund_done_at: string;
      }
    | undefined;

  if (!pay) {
    return { refunded: false, amountInr: 0, message: 'No paid payment row found for subscription' };
  }

  if (pay.refund_done_at) {
    return {
      refunded: false,
      amountInr: 0,
      message: 'Subscription booking refund already processed',
    };
  }

  const subRes = await query(
    `SELECT id, customer_id, pricing_snapshot FROM meal_subscriptions WHERE id = $1 LIMIT 1`,
    [subscriptionId],
  ).catch(() => ({ rows: [] }));
  const sub = subRes.rows?.[0] as
    | { id: string; customer_id: string; pricing_snapshot?: unknown }
    | undefined;
  if (!sub) {
    return { refunded: false, amountInr: 0, message: 'Subscription not found' };
  }

  const totalPaid = round2(parseFloat(pay.amount) || 0);
  const walletPaidTotal = round2(parseFloat(pay.wallet_debit_inr) || 0);

  const snap = parsePricingSnapshot(sub.pricing_snapshot);
  const platformFeeUpfront =
    Number(snap.platformFeeUpfront ?? snap.platform_fee_upfront ?? 0) || 0;
  /** Non-refundable to customer: platform fee only (delivery, convenience, GST, meal are refunded). */
  const platformFeeWithheld = round2(Math.min(Math.max(0, platformFeeUpfront), totalPaid));
  const refundableToCustomer = round2(Math.max(0, totalPaid - platformFeeWithheld));

  const walletShare = totalPaid > 0.009 ? walletPaidTotal / totalPaid : 0;
  let walletCredit = round2(refundableToCustomer * walletShare);
  let razorpayCredit = round2(refundableToCustomer - walletCredit);
  if (razorpayCredit < 0) {
    razorpayCredit = 0;
    walletCredit = round2(refundableToCustomer);
  }

  let razorpayRefundId: string | undefined;
  let walletCredited = 0;
  let didApply = false;

  await withTransaction(async (client) => {
    const lockPay = await client.query(
      `SELECT id, metadata FROM meal_subscription_payments WHERE id = $1 FOR UPDATE`,
      [pay.id],
    );
    const meta = (lockPay.rows?.[0]?.metadata || {}) as Record<string, unknown>;
    if (meta.vendor_parent_booking_full_refund_at) {
      return;
    }

    if (walletCredit > 0.009) {
      await client.query(
        `UPDATE wallets SET balance = balance + $2, updated_at = NOW() WHERE customer_id = $1`,
        [sub.customer_id, walletCredit],
      );
      await client.query(
        `INSERT INTO wallet_transactions (customer_id, amount, transaction_type, description, created_at)
         VALUES ($1, $2, 'credit', $3, NOW())`,
        [
          sub.customer_id,
          walletCredit,
          `Refund: vendor cancelled meal subscription (before prep) — ₹${platformFeeWithheld} platform fee retained — ${cancelReason}`,
        ],
      );
      walletCredited = walletCredit;
    }

    if (razorpayCredit > 0.009 && pay.provider_payment_id && pay.provider_payment_id !== 'wallet') {
      const rz = getRazorpayClient();
      const refundRes = await rz.payments.refund({
        payment_id: pay.provider_payment_id,
        amount: Math.round(razorpayCredit * 100),
      });
      razorpayRefundId = (refundRes as { id?: string }).id;
    }

    await client.query(
      `UPDATE meal_subscription_payments
       SET status = 'refunded',
           metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
             'vendor_parent_booking_full_refund_at', NOW()::text,
             'vendor_parent_booking_refund_customer_inr', $2::text,
             'vendor_parent_booking_platform_fee_withheld_inr', $3::text,
             'vendor_parent_booking_refund_wallet_inr', $4::text,
             'vendor_parent_booking_refund_razorpay_inr', $5::text,
             'vendor_parent_booking_refund_razorpay_id', $6::text,
             'vendor_parent_booking_refund_reason', $7
           ),
           updated_at = NOW()
       WHERE id = $1`,
      [
        pay.id,
        String(refundableToCustomer),
        String(platformFeeWithheld),
        String(walletCredited),
        String(razorpayCredit),
        razorpayRefundId ?? '',
        cancelReason,
      ],
    );

    await client.query(
      `UPDATE meal_subscriptions
       SET lifecycle_status = 'cancelled',
           status = 'cancelled',
           updated_at = NOW()
       WHERE id = $1`,
      [subscriptionId],
    );

    await client.query(
      `UPDATE meal_subscription_deliveries
       SET status = 'cancelled', updated_at = NOW()
       WHERE subscription_id = $1::uuid
         AND status NOT IN ('delivered', 'cancelled', 'skipped')`,
      [subscriptionId],
    );

    await client.query(
      `UPDATE meal_orders
       SET status = 'cancelled',
           cancelled_at = COALESCE(cancelled_at, NOW()),
           updated_at = NOW()
       WHERE subscription_id = $1::uuid
         AND status NOT IN ('delivered', 'cancelled')`,
      [subscriptionId],
    );

    didApply = true;
  });

  if (!didApply) {
    return {
      refunded: false,
      amountInr: 0,
      message: 'Subscription booking refund already processed',
    };
  }

  const msg =
    platformFeeWithheld > 0.009
      ? `Customer refunded ₹${refundableToCustomer} (₹${platformFeeWithheld} platform fee retained).`
      : `Customer refunded ₹${refundableToCustomer}.`;

  return {
    refunded: true,
    razorpayRefundId,
    walletCredited,
    amountInr: refundableToCustomer,
    platformFeeRetainedInr: platformFeeWithheld,
    totalPaidInr: totalPaid,
    message: razorpayRefundId ? `${msg} Razorpay: ${razorpayRefundId}` : msg,
  };
}
