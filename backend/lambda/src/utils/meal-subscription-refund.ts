/**
 * Refund logic for individual meal subscription session cancellations by vendor.
 * Per-session refund = upfront payment ÷ total_sessions, minus wallet portion.
 * Calls Razorpay for card/UPI payments; credits wallet directly for wallet-only sessions.
 */

import { query, withTransaction } from '../database/rds-connection';
import { getRazorpayClient } from './payments/razorpay-client';

export interface MealSessionRefundResult {
  refunded: boolean;
  razorpayRefundId?: string;
  walletCredited?: number;
  amountInr: number;
  message: string;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Processes a proportional refund when a vendor cancels a meal subscription session.
 *
 * Logic:
 *  1. Fetch the subscription + its paid payment row.
 *  2. Per-session = payment.amount / total_sessions.
 *  3. Wallet portion = per-session × (wallet_debit_inr / total_paid); refund via wallet credit.
 *  4. Razorpay portion = remainder; call Razorpay refunds API if provider_payment_id exists.
 *  5. Record metadata on the delivery row (idempotent via `refund_processed` flag).
 */
export async function processMealSessionVendorCancelRefund(
  subscriptionId: string,
  deliveryId: string,
  sessionNumber: number,
  cancelReason: string,
): Promise<MealSessionRefundResult> {
  // Idempotency: skip if refund already processed for this delivery
  const existCheck = await query(
    `SELECT id, metadata FROM meal_subscription_deliveries WHERE id = $1 LIMIT 1`,
    [deliveryId],
  ).catch(() => ({ rows: [] }));
  const existRow = existCheck.rows?.[0] as { id: string; metadata?: Record<string, unknown> } | undefined;
  if (existRow?.metadata?.refund_processed) {
    return {
      refunded: false,
      amountInr: 0,
      message: 'Refund already processed for this session',
    };
  }

  // Fetch subscription
  const subRes = await query(
    `SELECT id, customer_id, total_sessions FROM meal_subscriptions WHERE id = $1 LIMIT 1`,
    [subscriptionId],
  ).catch(() => ({ rows: [] }));
  const sub = subRes.rows?.[0] as
    | { id: string; customer_id: string; total_sessions: number | string }
    | undefined;
  if (!sub) {
    return { refunded: false, amountInr: 0, message: 'Subscription not found' };
  }
  const totalSessions = Math.max(1, Number(sub.total_sessions) || 1);
  const customerId = String(sub.customer_id);

  // Fetch paid payment row
  const payRes = await query(
    `SELECT id, amount::text, provider_payment_id, provider,
            COALESCE(metadata->>'wallet_debit_inr', '0') AS wallet_debit_inr
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
      }
    | undefined;

  if (!pay) {
    return { refunded: false, amountInr: 0, message: 'No paid payment row found for subscription' };
  }

  const totalPaid = parseFloat(pay.amount) || 0;
  const walletPaidTotal = parseFloat(pay.wallet_debit_inr) || 0;
  const perSessionTotal = round2(totalPaid / totalSessions);
  const walletShare = totalPaid > 0 ? walletPaidTotal / totalPaid : 0;
  const perSessionWallet = round2(perSessionTotal * walletShare);
  const perSessionRazorpay = round2(perSessionTotal - perSessionWallet);

  let razorpayRefundId: string | undefined;
  let walletCredited = 0;

  await withTransaction(async (client) => {
    // Credit wallet portion back
    if (perSessionWallet > 0.009) {
      await client.query(
        `UPDATE wallets
         SET balance = balance + $2,
             updated_at = NOW()
         WHERE customer_id = $1`,
        [customerId, perSessionWallet],
      );
      await client.query(
        `INSERT INTO wallet_transactions
           (customer_id, amount, transaction_type, description, created_at)
         VALUES ($1, $2, 'credit', $3, NOW())`,
        [
          customerId,
          perSessionWallet,
          `Refund: vendor cancelled Meal Plan session ${sessionNumber} — ${cancelReason}`,
        ],
      );
      walletCredited = perSessionWallet;
    }

    // Razorpay refund for the non-wallet portion
    if (perSessionRazorpay > 0.009 && pay.provider_payment_id && pay.provider_payment_id !== 'wallet') {
      try {
        const rz = getRazorpayClient();
        const refundRes = await rz.payments.refund(pay.provider_payment_id, {
          amount: Math.round(perSessionRazorpay * 100), // paise
          notes: {
            reason: cancelReason,
            subscription_id: subscriptionId,
            delivery_id: deliveryId,
            session_number: String(sessionNumber),
          },
        });
        razorpayRefundId = (refundRes as { id?: string }).id;
      } catch (rzErr: unknown) {
        const e = rzErr as { message?: string };
        console.error('[meal-session-refund] Razorpay refund failed', e.message, {
          subscriptionId,
          deliveryId,
        });
        throw Object.assign(new Error(`Refund failed: ${e.message || 'Razorpay error'}`), {
          statusCode: 502,
        });
      }
    }

    // Mark refund processed on delivery row
    await client.query(
      `UPDATE meal_subscription_deliveries
       SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
           'refund_processed', true,
           'refund_amount_inr', $2::text,
           'refund_wallet_inr', $3::text,
           'refund_razorpay_id', $4::text,
           'refund_reason', $5,
           'refund_at', $6
         ),
           updated_at = NOW()
       WHERE id = $1`,
      [
        deliveryId,
        String(perSessionTotal),
        String(walletCredited),
        razorpayRefundId ?? '',
        cancelReason,
        new Date().toISOString(),
      ],
    );
  });

  return {
    refunded: true,
    razorpayRefundId,
    walletCredited,
    amountInr: perSessionTotal,
    message: razorpayRefundId
      ? `Refund of ₹${perSessionTotal} initiated (Razorpay: ${razorpayRefundId})`
      : walletCredited > 0
        ? `₹${walletCredited} credited to wallet`
        : 'Refund recorded',
  };
}
