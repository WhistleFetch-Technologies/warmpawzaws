/**
 * Reconcile Razorpay refund.created / refund.processed webhooks with refunds table.
 */

import type { PoolClient } from 'pg';
import { query, withTransaction } from '../../database/rds-connection';
import { ACTIVE_REFUND_STATUS_FILTER, mapRazorpayRefundEventStatus } from './refund-status';
import { markShopOrderPaymentRefundedIfFull, notifyShopRefundLifecycle } from './shop-order-refund';

export interface RazorpayRefundWebhookInput {
  razorpayRefundId: string;
  razorpayPaymentId: string;
  refundAmountInr: number;
  razorpayStatus: string;
  refundReason?: string | null;
}

export async function reconcileRazorpayRefundWebhook(
  input: RazorpayRefundWebhookInput,
): Promise<{ paymentId: string; isFullRefund: boolean; orderId?: string } | null> {
  const { rows: paymentRows } = await query(
    `SELECT id, booking_id, order_id, customer_id, amount, payment_status
     FROM payments
     WHERE razorpay_payment_id = $1`,
    [input.razorpayPaymentId],
  );

  if (paymentRows.length === 0) {
    console.warn(`[RAZORPAY-WEBHOOK] Payment not found for refund: ${input.razorpayRefundId}`);
    return null;
  }

  const payment = paymentRows[0];
  const paymentAmount = parseFloat(String(payment.amount ?? '0')) || 0;
  const dbRefundStatus = mapRazorpayRefundEventStatus(input.razorpayStatus);
  const refundReason = input.refundReason || 'Razorpay refund';

  const { rows: refundedRows } = await query(
    `SELECT COALESCE(SUM(refund_amount), 0)::text AS total_refunded
     FROM refunds
     WHERE payment_id = $1::uuid
       AND ${ACTIVE_REFUND_STATUS_FILTER}`,
    [payment.id],
  );

  const priorRefunded = parseFloat(String(refundedRows[0]?.total_refunded ?? '0')) || 0;

  let shopOrderId: string | undefined = payment.order_id ? String(payment.order_id) : undefined;
  let shopRefundId: string | undefined;
  let notifyCompleted = false;
  let isFullRefund = false;

  await withTransaction(async (client: PoolClient) => {
    const { rows: existingRefund } = await client.query(
      `SELECT id::text, order_id::text FROM refunds WHERE razorpay_refund_id = $1`,
      [input.razorpayRefundId],
    );

    const isExisting = existingRefund.length > 0;
    const totalRefunded = isExisting
      ? priorRefunded
      : priorRefunded + input.refundAmountInr;
    isFullRefund = totalRefunded >= paymentAmount - 0.009;
    const newPaymentStatus = isFullRefund ? 'refunded' : 'partially_refunded';

    if (isExisting) {
      shopRefundId = existingRefund[0]?.id ? String(existingRefund[0].id) : undefined;
      if (existingRefund[0]?.order_id) {
        shopOrderId = String(existingRefund[0].order_id);
      }

      await client.query(
        `UPDATE refunds
         SET refund_status = $1,
             processed_at = COALESCE(processed_at, NOW()),
             completed_at = CASE WHEN $1 = 'completed' THEN COALESCE(completed_at, NOW()) ELSE completed_at END
         WHERE razorpay_refund_id = $2`,
        [dbRefundStatus, input.razorpayRefundId],
      );
      notifyCompleted = dbRefundStatus === 'completed';
    } else {
      const customerId = payment.customer_id;
      if (!customerId) {
        throw new Error(`Payment ${payment.id} missing customer_id for refund insert`);
      }

      const ins = await client.query(
        `INSERT INTO refunds (
           payment_id, booking_id, order_id, customer_id, refund_amount, refund_reason,
           refund_status, razorpay_refund_id, requested_at, processed_at,
           completed_at
         ) VALUES (
           $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6, $7, $8, NOW(), NOW(),
           CASE WHEN $7 = 'completed' THEN NOW() ELSE NULL END
         )
         RETURNING id::text, order_id::text`,
        [
          payment.id,
          payment.booking_id || null,
          payment.order_id || null,
          customerId,
          input.refundAmountInr,
          refundReason,
          dbRefundStatus,
          input.razorpayRefundId,
        ],
      );
      shopRefundId = ins.rows[0]?.id ? String(ins.rows[0].id) : undefined;
      if (ins.rows[0]?.order_id) {
        shopOrderId = String(ins.rows[0].order_id);
      }
      notifyCompleted = dbRefundStatus === 'completed';
    }

    await client.query(
      `UPDATE payments SET payment_status = $1, updated_at = NOW() WHERE id = $2::uuid`,
      [newPaymentStatus, payment.id],
    );

    if (payment.booking_id) {
      const bookingPaymentStatus = isFullRefund ? 'refunded' : 'partial';
      await client.query(
        `UPDATE bookings SET payment_status = $1, updated_at = NOW() WHERE id = $2::uuid`,
        [bookingPaymentStatus, payment.booking_id],
      );
    }

    if (shopOrderId && isFullRefund) {
      await markShopOrderPaymentRefundedIfFull(shopOrderId, client);
    }
  });

  if (notifyCompleted && shopOrderId) {
    void notifyShopRefundLifecycle({
      orderId: shopOrderId,
      refundId: shopRefundId,
      event: 'completed',
      amount: input.refundAmountInr,
      customerId: payment.customer_id ? String(payment.customer_id) : undefined,
    }).catch(() => {});
  }

  return {
    paymentId: String(payment.id),
    isFullRefund,
    orderId: shopOrderId,
  };
}
