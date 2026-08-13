/**
 * Original-payment (Razorpay) refund orchestrator for bookings.
 * Handles split wallet + gateway payments, idempotency, DB records, and notifications.
 */

import { query, withTransaction } from '../../database/rds-connection';
import { getRazorpayClient } from './razorpay-client';
import { resolveBookingPaymentSources } from './booking-payment-sources';
import { creditCustomerWalletForBookingRefund } from '../credit-customer-wallet';
import {
  resolvePaymentCapturableGross,
  resolveRelatedPaymentBookingIds,
} from '../../lib/services/refundable-base';

export type RefundInitiator = 'customer' | 'vendor' | 'admin' | 'system' | 'support';

export type BookingOriginalRefundParams = {
  bookingId: string;
  customerId: string;
  vendorId?: string | null;
  refundAmount: number;
  reason: string;
  initiatedBy?: RefundInitiator;
  supportTicketId?: string;
  skipNotification?: boolean;
  /** Reuse an existing pending refund row (admin / legacy flows). */
  existingRefundId?: string;
  refundPercentage?: number;
  label?: 'booking' | 'appointment';
};

export type OriginalPaymentRefundResult = {
  refundId?: string;
  razorpayRefundId?: string;
  walletCredited: number;
  razorpayAmount: number;
  totalAmount: number;
  status: 'completed' | 'processing' | 'failed' | 'wallet_only' | 'skipped';
  message: string;
  alreadyProcessed?: boolean;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** True when the booking has a non-wallet gateway capture eligible for Razorpay refund. */
export async function bookingHasGatewayPayment(bookingId: string): Promise<boolean> {
  if (!bookingId) return false;
  try {
    const lookupIds = await resolveRelatedPaymentBookingIds(bookingId);
    const payRes = await query(
      `SELECT id FROM payments
       WHERE booking_id = ANY($1::uuid[])
         AND payment_status IN ('completed', 'partially_refunded')
         AND razorpay_payment_id IS NOT NULL
         AND COALESCE(payment_method, '') <> 'wallet'
       LIMIT 1`,
      [lookupIds]
    );
    if ((payRes as any).rows?.length > 0) return true;

    const sources = await resolveBookingPaymentSources(bookingId);
    return sources.some((s) => s.method !== 'wallet' && s.amount > 0.009);
  } catch {
    return false;
  }
}

async function loadGatewayPayment(bookingId: string): Promise<{
  id: string;
  amount: number;
  capturable: number;
  razorpay_payment_id: string;
  payment_status: string;
  customer_id: string;
} | null> {
  let row: any;
  const lookupIds = await resolveRelatedPaymentBookingIds(bookingId);
  try {
    const res = await query(
      `SELECT id, amount::text, total_amount::text, gst_amount::text,
              razorpay_payment_id, payment_status, customer_id::text
       FROM payments
       WHERE booking_id = ANY($1::uuid[])
         AND payment_status IN ('completed', 'partially_refunded')
         AND razorpay_payment_id IS NOT NULL
         AND COALESCE(payment_method, '') <> 'wallet'
       ORDER BY CASE WHEN payment_status = 'completed' THEN 0 ELSE 1 END, created_at DESC
       LIMIT 1`,
      [lookupIds]
    );
    row = (res as any).rows?.[0];
  } catch {
    const res = await query(
      `SELECT id, amount::text, razorpay_payment_id, payment_status, customer_id::text
       FROM payments
       WHERE booking_id = ANY($1::uuid[])
         AND payment_status IN ('completed', 'partially_refunded')
         AND razorpay_payment_id IS NOT NULL
         AND COALESCE(payment_method, '') <> 'wallet'
       ORDER BY CASE WHEN payment_status = 'completed' THEN 0 ELSE 1 END, created_at DESC
       LIMIT 1`,
      [lookupIds]
    );
    row = (res as any).rows?.[0];
  }
  if (!row?.id || !row.razorpay_payment_id) return null;
  const amount = parseFloat(String(row.amount ?? '0')) || 0;
  const capturable = resolvePaymentCapturableGross({
    amount,
    total_amount: row.total_amount,
    gst_amount: row.gst_amount,
  });
  return {
    id: String(row.id),
    amount,
    capturable: capturable > 0.009 ? capturable : amount,
    razorpay_payment_id: String(row.razorpay_payment_id),
    payment_status: String(row.payment_status ?? ''),
    customer_id: String(row.customer_id ?? ''),
  };
}

async function sumProcessedRefundsForPayment(paymentId: string): Promise<number> {
  const res = await query(
    `SELECT COALESCE(SUM(refund_amount), 0)::text AS total
     FROM refunds
     WHERE payment_id = $1::uuid
       AND refund_status IN ('completed', 'processing', 'approved', 'processed')`,
    [paymentId]
  );
  return parseFloat(String((res as any).rows?.[0]?.total ?? '0')) || 0;
}

async function findActiveOriginalRefund(bookingId: string): Promise<{ id: string; refund_status: string } | null> {
  const res = await query(
    `SELECT id::text, refund_status
     FROM refunds
     WHERE booking_id = $1::uuid
       AND refund_method = 'original'
       AND refund_status NOT IN ('failed', 'rejected')
     ORDER BY requested_at DESC NULLS LAST
     LIMIT 1`,
    [bookingId]
  );
  const row = (res as any).rows?.[0];
  return row?.id ? { id: String(row.id), refund_status: String(row.refund_status) } : null;
}

function splitRefundAmount(
  refundAmount: number,
  walletPaid: number,
  gatewayPaid: number
): { walletSlice: number; gatewaySlice: number } {
  const totalPaid = round2(walletPaid + gatewayPaid);
  if (refundAmount <= 0.009) return { walletSlice: 0, gatewaySlice: 0 };
  if (totalPaid <= 0.009) {
    return { walletSlice: 0, gatewaySlice: round2(refundAmount) };
  }
  const walletShare = walletPaid / totalPaid;
  const walletSlice = round2(refundAmount * walletShare);
  const gatewaySlice = round2(Math.max(0, refundAmount - walletSlice));
  return { walletSlice, gatewaySlice };
}

async function callRazorpayRefund(
  razorpayPaymentId: string,
  amountInr: number,
  notes: Record<string, string>
): Promise<{ id: string; status: string }> {
  const razorpay = getRazorpayClient();
  const refundResult = await razorpay.payments.refund({
    payment_id: razorpayPaymentId,
    amount: Math.round(amountInr * 100),
  });
  return {
    id: String((refundResult as { id?: string }).id ?? ''),
    status: String((refundResult as { status?: string }).status ?? 'processing'),
  };
}

/**
 * Process an automatic original-payment refund for a booking (customer / vendor cancel, support).
 */
export async function processBookingOriginalPaymentRefund(
  params: BookingOriginalRefundParams
): Promise<OriginalPaymentRefundResult> {
  const {
    bookingId,
    customerId,
    vendorId = null,
    refundAmount,
    reason,
    initiatedBy = 'system',
    supportTicketId,
    skipNotification = false,
    existingRefundId,
    refundPercentage = 100,
    label = 'booking',
  } = params;

  if (!bookingId || !customerId || !Number.isFinite(refundAmount) || refundAmount <= 0) {
    throw new Error('Invalid original-payment refund parameters');
  }

  if (!existingRefundId) {
    const existing = await findActiveOriginalRefund(bookingId);
    if (existing && ['completed', 'processing', 'approved', 'processed'].includes(existing.refund_status)) {
      return {
        walletCredited: 0,
        razorpayAmount: 0,
        totalAmount: refundAmount,
        status: 'skipped',
        message: 'Refund already initiated for this booking',
        refundId: existing.id,
        alreadyProcessed: true,
      };
    }
  }

  const sources = await resolveBookingPaymentSources(bookingId);
  const walletPaid = round2(
    sources.filter((s) => s.method === 'wallet').reduce((a, s) => a + s.amount, 0)
  );
  const gatewayPaid = round2(
    sources.filter((s) => s.method !== 'wallet').reduce((a, s) => a + s.amount, 0)
  );
  const { walletSlice, gatewaySlice } = splitRefundAmount(refundAmount, walletPaid, gatewayPaid);

  let walletCredited = 0;
  if (walletSlice > 0.009) {
    try {
      const credit = await creditCustomerWalletForBookingRefund({
        customerId,
        bookingId,
        refundAmount: walletSlice,
        refundPercentage,
        label,
      });
      walletCredited = walletSlice;
      if (credit.alreadyCredited) {
        walletCredited = walletSlice;
      }
    } catch (err) {
      console.error('[booking-original-refund] wallet slice credit failed:', err);
      throw err;
    }
  }

  const payment = await loadGatewayPayment(bookingId);

  if (gatewaySlice <= 0.009 || !payment) {
    if (walletCredited > 0.009) {
      return {
        walletCredited,
        razorpayAmount: 0,
        totalAmount: round2(walletCredited),
        status: 'wallet_only',
        message: `₹${walletCredited.toFixed(2)} credited to Warmpawz wallet`,
      };
    }
    throw new Error('No gateway payment found for original-method refund');
  }

  const alreadyRefunded = await sumProcessedRefundsForPayment(payment.id);
  const capturable = payment.capturable > 0.009 ? payment.capturable : payment.amount;
  const availableOnPayment = round2(capturable - alreadyRefunded);
  const razorpayAmount = round2(Math.min(gatewaySlice, availableOnPayment));

  if (razorpayAmount <= 0.009) {
    return {
      walletCredited,
      razorpayAmount: 0,
      totalAmount: round2(walletCredited),
      status: walletCredited > 0 ? 'wallet_only' : 'failed',
      message:
        walletCredited > 0
          ? `₹${walletCredited.toFixed(2)} credited to wallet (gateway portion already refunded)`
          : 'No refundable gateway balance remaining on this payment',
    };
  }

  let razorpayRefundId: string | undefined;
  let refundId: string | undefined;
  let finalStatus: 'completed' | 'processing' | 'failed' = 'processing';

  try {
    const rzResult = await callRazorpayRefund(payment.razorpay_payment_id, razorpayAmount, {
      reason,
      booking_id: bookingId,
      initiated_by: initiatedBy,
    });
    razorpayRefundId = rzResult.id;
    finalStatus = rzResult.status === 'processed' ? 'completed' : 'processing';

    const refundStatusDb = finalStatus === 'completed' ? 'completed' : 'processing';
    const isFullPaymentRefund = round2(alreadyRefunded + razorpayAmount) >= capturable - 0.01;
    const newPaymentStatus = isFullPaymentRefund ? 'refunded' : 'partially_refunded';

    await withTransaction(async (client) => {
      if (existingRefundId) {
        await client.query(
          `UPDATE refunds SET
             refund_amount = $2,
             refund_reason = $3,
             refund_status = $4,
             razorpay_refund_id = $5,
             refund_method = 'original',
             processed_at = NOW()
           WHERE id = $1::uuid`,
          [existingRefundId, razorpayAmount, reason, refundStatusDb, razorpayRefundId || null]
        );
        refundId = existingRefundId;
      } else {
        const insertCols = [
          'payment_id',
          'booking_id',
          'customer_id',
          'refund_amount',
          'refund_reason',
          'refund_status',
          'refund_method',
          'razorpay_refund_id',
          'requested_at',
          'processed_at',
        ];
        const insertVals: unknown[] = [
          payment.id,
          bookingId,
          customerId,
          razorpayAmount,
          reason,
          refundStatusDb,
          'original',
          razorpayRefundId || null,
          new Date().toISOString(),
          new Date().toISOString(),
        ];

        if (vendorId) {
          insertCols.push('vendor_id');
          insertVals.push(vendorId);
        }

        const ph = insertVals.map((_, i) => `$${i + 1}`).join(', ');
        const ins = await client.query(
          `INSERT INTO refunds (${insertCols.join(', ')}) VALUES (${ph}) RETURNING id::text`,
          insertVals
        );
        refundId = ins.rows[0]?.id;
      }

      await client.query(
        `UPDATE payments SET payment_status = $1, updated_at = NOW() WHERE id = $2::uuid`,
        [newPaymentStatus, payment.id]
      );
      await client.query(
        `UPDATE bookings SET payment_status = $1, updated_at = NOW() WHERE id = $2::uuid`,
        [newPaymentStatus, bookingId]
      );
    });

    const totalReturned = round2(walletCredited + razorpayAmount);
    const messageParts: string[] = [];
    if (walletCredited > 0.009) {
      messageParts.push(`₹${walletCredited.toFixed(2)} credited to wallet`);
    }
    if (razorpayAmount > 0.009) {
      messageParts.push(
        `₹${razorpayAmount.toFixed(2)} refund to original payment method (typically 5–7 business days)`
      );
    }

    if (!skipNotification && refundId) {
      setImmediate(async () => {
        try {
          const { sendRefundNotification } = await import('./refund-service');
          await sendRefundNotification({
            customerId,
            bookingId,
            amount: totalReturned,
            reason,
            refundId: refundId || '',
          });
        } catch (e) {
          console.error('[booking-original-refund] notification failed:', e);
        }
      });
    }

    return {
      refundId,
      razorpayRefundId,
      walletCredited,
      razorpayAmount,
      totalAmount: totalReturned,
      status: finalStatus,
      message: messageParts.join('; ') || 'Refund initiated',
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Razorpay refund failed';
    console.error('[booking-original-refund] Razorpay failed:', msg, { bookingId });

    if (existingRefundId) {
      await query(
        `UPDATE refunds SET refund_status = 'failed' WHERE id = $1::uuid`,
        [existingRefundId]
      ).catch(() => null);
    }

    if (walletCredited > 0.009) {
      return {
        walletCredited,
        razorpayAmount: 0,
        totalAmount: walletCredited,
        status: 'failed',
        message: `Wallet portion credited (₹${walletCredited.toFixed(2)}), but gateway refund failed: ${msg}. Contact support.`,
      };
    }
    throw err;
  }
}

/**
 * Execute a pending refund row (admin approve / legacy pending records).
 */
export async function processExistingPendingRefund(
  refundId: string,
  options?: { adminComment?: string; skipNotification?: boolean }
): Promise<OriginalPaymentRefundResult> {
  const res = await query(
    `SELECT r.*, p.razorpay_payment_id, p.amount::text AS payment_amount, p.payment_status
     FROM refunds r
     LEFT JOIN payments p ON r.payment_id = p.id
     WHERE r.id = $1::uuid
     LIMIT 1`,
    [refundId]
  );
  const row = (res as any).rows?.[0];
  if (!row) throw new Error('Refund not found');

  const status = String(row.refund_status ?? '');
  if (!['pending', 'approved'].includes(status)) {
    throw new Error(`Refund not in pending state (current: ${status})`);
  }

  const bookingId = row.booking_id ? String(row.booking_id) : '';
  const customerId = row.customer_id ? String(row.customer_id) : '';
  const refundAmount = parseFloat(String(row.refund_amount ?? '0')) || 0;
  const reason = String(row.refund_reason ?? 'Refund approved by admin');

  if (!bookingId || !customerId) {
    throw new Error('Refund row missing booking_id or customer_id');
  }

  if (options?.adminComment) {
    await query(`UPDATE refunds SET admin_comment = $2 WHERE id = $1::uuid`, [
      refundId,
      options.adminComment,
    ]).catch(() => null);
  }

  return processBookingOriginalPaymentRefund({
    bookingId,
    customerId,
    vendorId: row.vendor_id ? String(row.vendor_id) : null,
    refundAmount,
    reason,
    initiatedBy: 'admin',
    existingRefundId: refundId,
    skipNotification: options?.skipNotification,
  });
}
