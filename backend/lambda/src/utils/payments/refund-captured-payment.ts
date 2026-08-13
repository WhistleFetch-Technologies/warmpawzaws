/**
 * Idempotent refund of one captured Razorpay payment row (duplicate capture or
 * unfulfillable late capture). Never issues two gateway refunds for one payment.
 */

import type { PoolClient } from 'pg';
import { query, withTransaction } from '../../database/rds-connection';
import { getRazorpayClient } from './razorpay-client';
import { logPaymentSafety } from './payment-attempt';
import { mapRazorpayRefundEventStatus } from './refund-status';

export type CapturedPaymentRefundReason =
  | 'duplicate_capture'
  | 'late_capture_slot_unavailable'
  | 'late_capture_inventory_unavailable'
  | 'unfulfillable_captured_payment';

export async function refundCapturedPaymentById(input: {
  paymentId: string;
  reason: CapturedPaymentRefundReason;
  source: string;
}): Promise<{ refundId: string | null; alreadyProcessed: boolean; razorpayRefundId?: string }> {
  const paymentId = String(input.paymentId);
  let refundRowId: string | null = null;
  let razorpayPaymentId: string | null = null;
  let amountPaise = 0;
  let skipGateway = false;
  let existingRz: string | undefined;

  await withTransaction(async (client: PoolClient) => {
    const pay = await client.query(
      `SELECT id, razorpay_payment_id, amount, payment_status, booking_id, order_id, customer_id, vendor_id
       FROM payments WHERE id = $1::uuid FOR UPDATE`,
      [paymentId]
    );
    if (pay.rows.length === 0) return;
    const row = pay.rows[0];
    razorpayPaymentId = row.razorpay_payment_id ? String(row.razorpay_payment_id) : null;
    amountPaise = Math.round((parseFloat(String(row.amount ?? '0')) || 0) * 100);

    const existing = await client.query(
      `SELECT id::text, refund_status, razorpay_refund_id
       FROM refunds
       WHERE payment_id = $1::uuid
         AND LOWER(COALESCE(refund_status, '')) NOT IN ('failed', 'rejected')
       ORDER BY requested_at DESC NULLS LAST
       LIMIT 1
       FOR UPDATE`,
      [paymentId]
    );
    if (existing.rows[0]) {
      refundRowId = String(existing.rows[0].id);
      existingRz = existing.rows[0].razorpay_refund_id ? String(existing.rows[0].razorpay_refund_id) : undefined;
      const st = String(existing.rows[0].refund_status || '').toLowerCase();
      skipGateway = Boolean(existingRz) || ['completed', 'approved', 'processing', 'pending'].includes(st);
      if (st === 'pending' && !existingRz) skipGateway = false;
      return;
    }

    if (!razorpayPaymentId || amountPaise <= 0) return;

    try {
      await client.query('SAVEPOINT refund_insert');
      const ins = await client.query(
        `INSERT INTO refunds (
           payment_id, booking_id, order_id, customer_id, vendor_id,
           refund_amount, refund_reason, refund_status, refund_method, idempotency_key, requested_at
         ) VALUES (
           $1::uuid, $2, $3, $4, $5, $6, $7, 'pending', 'original', $8, NOW()
         )
         RETURNING id::text`,
        [
          paymentId,
          row.booking_id || null,
          row.order_id || null,
          row.customer_id,
          row.vendor_id || null,
          amountPaise / 100,
          input.reason,
          `wp-refund-${paymentId}`,
        ]
      );
      await client.query('RELEASE SAVEPOINT refund_insert');
      refundRowId = ins.rows[0]?.id || null;
    } catch (insErr: any) {
      await client.query('ROLLBACK TO SAVEPOINT refund_insert').catch(() => undefined);
      if (insErr?.code !== '23505') throw insErr;
      const again = await client.query(
        `SELECT id::text, refund_status, razorpay_refund_id
         FROM refunds
         WHERE payment_id = $1::uuid
           AND LOWER(COALESCE(refund_status, '')) NOT IN ('failed', 'rejected')
         ORDER BY requested_at DESC NULLS LAST
         LIMIT 1`,
        [paymentId]
      );
      if (again.rows[0]) {
        refundRowId = String(again.rows[0].id);
        existingRz = again.rows[0].razorpay_refund_id ? String(again.rows[0].razorpay_refund_id) : undefined;
        skipGateway = Boolean(existingRz) || ['completed', 'approved', 'processing'].includes(
          String(again.rows[0].refund_status || '').toLowerCase()
        );
      }
    }
  });

  if (!refundRowId) {
    return { refundId: null, alreadyProcessed: true };
  }
  if (skipGateway) {
    logPaymentSafety('refund_already_present', {
      payment_id: paymentId,
      refund_id: refundRowId,
      reason: input.reason,
      source: input.source,
    });
    return { refundId: refundRowId, alreadyProcessed: true, razorpayRefundId: existingRz };
  }
  if (!razorpayPaymentId) {
    return { refundId: refundRowId, alreadyProcessed: false };
  }

  try {
    const rz = await getRazorpayClient().payments.refund({
      payment_id: razorpayPaymentId,
      amount: amountPaise,
      idempotencyKey: `wp-refund-${paymentId}`,
    });
    const rzId = String((rz as { id?: string }).id || '');
    const rzStatus = mapRazorpayRefundEventStatus(String((rz as { status?: string }).status || 'processing'));
    await query(
      `UPDATE refunds SET
         razorpay_refund_id = COALESCE(razorpay_refund_id, $1),
         refund_status = $2,
         processed_at = COALESCE(processed_at, NOW()),
         completed_at = CASE WHEN $2 = 'completed' THEN COALESCE(completed_at, NOW()) ELSE completed_at END
       WHERE id = $3::uuid`,
      [rzId || null, rzStatus, refundRowId]
    );
    if (rzStatus === 'completed') {
      await query(
        `UPDATE payments SET payment_status = 'refunded', updated_at = NOW() WHERE id = $1::uuid`,
        [paymentId]
      );
    }
    logPaymentSafety('refund', {
      payment_id: paymentId,
      refund_id: refundRowId,
      razorpay_refund_id: rzId,
      reason: input.reason,
      source: input.source,
      status: rzStatus,
    });
    return { refundId: refundRowId, alreadyProcessed: false, razorpayRefundId: rzId || undefined };
  } catch (err: any) {
    logPaymentSafety('refund_gateway_error', {
      payment_id: paymentId,
      refund_id: refundRowId,
      reason: input.reason,
      source: input.source,
      error: err?.message || String(err),
    });
    return { refundId: refundRowId, alreadyProcessed: false };
  }
}
