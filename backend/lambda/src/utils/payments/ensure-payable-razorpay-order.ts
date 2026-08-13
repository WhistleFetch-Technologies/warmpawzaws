/**
 * Lock entity, keep a single active payable attempt, reuse Razorpay order when still payable.
 * Razorpay Orders API has no idempotency header; receipt is unique per payment row.
 */

import { withTransaction } from '../../database/rds-connection';
import { razorpayRequest } from './razorpay-client';
import { finalizeCapturedPayment } from './finalize-captured-payment';
import { isHoldExpiryCancelReason, logPaymentSafety } from './payment-attempt';

export type EnsurePayableKind = 'booking' | 'shop';

export type EnsurePayableResult =
  | { action: 'reuse' | 'created'; razorpayOrderId: string; amount: number; currency: string; reused: boolean; paymentId: string }
  | { action: 'already_paid'; razorpayOrderId: string | null }
  | { action: 'rejected'; error: string; status: number };

function receiptForPayment(kind: EnsurePayableKind, paymentId: string): string {
  const compact = String(paymentId).replace(/-/g, '');
  const prefix = kind === 'shop' ? 'eco' : 'bk';
  return `${prefix}_${compact}`.slice(0, 40);
}

async function fetchRazorpayOrder(orderId: string): Promise<{ status?: string; amount?: number; currency?: string } | null> {
  try {
    return (await razorpayRequest(`/orders/${orderId}`, 'GET', undefined, 8000)) as {
      status?: string;
      amount?: number;
      currency?: string;
    };
  } catch {
    return null;
  }
}

async function fetchRazorpayOrderByReceipt(
  receipt: string
): Promise<{ id: string; status?: string; amount?: number; currency?: string } | null> {
  try {
    const res = (await razorpayRequest(
      `/orders?receipt=${encodeURIComponent(receipt)}&count=5`,
      'GET',
      undefined,
      8000
    )) as {
      items?: Array<{ id?: string; status?: string; amount?: number; currency?: string }>;
    };
    const item = (res?.items || []).find((row) => row?.id);
    if (!item?.id) return null;
    return {
      id: String(item.id),
      status: item.status,
      amount: item.amount,
      currency: item.currency,
    };
  } catch {
    return null;
  }
}

async function attachRazorpayOrderId(paymentId: string, razorpayOrderId: string, amount: number, currency: string): Promise<void> {
  await withTransaction(async (client) => {
    await client.query(
      `UPDATE payments SET razorpay_order_id = $1, amount = $2, currency = $3, updated_at = NOW()
       WHERE id = $4::uuid AND razorpay_order_id IS NULL`,
      [razorpayOrderId, amount, currency, paymentId]
    );
  });
}

export async function ensurePayableRazorpayOrder(
  input: {
    kind: EnsurePayableKind;
    entityId: string;
    chargeAmount: number;
    currency: string;
    customerId: string;
    vendorId?: string | null;
    notes: Record<string, string>;
    transfers?: unknown;
  },
  depth = 0
): Promise<EnsurePayableResult> {
  const { kind, entityId, currency, customerId } = input;
  const vendorId = input.vendorId || null;
  const chargeAmount = Math.round(Number(input.chargeAmount) * 100) / 100;
  if (!(chargeAmount > 0)) {
    return { action: 'rejected', error: 'Invalid charge amount', status: 400 };
  }

  type Seed = { paymentId: string; razorpayOrderId: string | null; amount: number; alreadyPaid?: boolean };
  let seed: Seed | null = null;

  try {
    seed = await withTransaction(async (client) => {
      if (kind === 'booking') {
        const b = await client.query(
          `SELECT id, status, payment_status, cancellation_reason FROM bookings WHERE id = $1::uuid FOR UPDATE`,
          [entityId]
        );
        if (!b.rows[0]) throw Object.assign(new Error('Booking not found'), { httpStatus: 404 });
        const st = String(b.rows[0].status || '');
        const ps = String(b.rows[0].payment_status || '').toLowerCase();
        if (ps === 'paid' || st === 'confirmed') {
          return { paymentId: '', razorpayOrderId: null, amount: 0, alreadyPaid: true };
        }
        if (st === 'cancelled' && !isHoldExpiryCancelReason(b.rows[0].cancellation_reason)) {
          throw Object.assign(new Error('Booking is cancelled'), { httpStatus: 410 });
        }
        const existing = await client.query(
          `SELECT id, razorpay_order_id, amount
           FROM payments
           WHERE booking_id = $1::uuid
             AND LOWER(COALESCE(payment_status, '')) IN ('pending', 'processing')
           ORDER BY created_at DESC
           LIMIT 1
           FOR UPDATE`,
          [entityId]
        );
        if (existing.rows[0]) {
          return {
            paymentId: String(existing.rows[0].id),
            razorpayOrderId: existing.rows[0].razorpay_order_id ? String(existing.rows[0].razorpay_order_id) : null,
            amount: Number(existing.rows[0].amount) || chargeAmount,
          };
        }
        const ins = await client.query(
          `INSERT INTO payments (booking_id, customer_id, vendor_id, amount, currency, payment_method, payment_status)
           VALUES ($1::uuid, $2::uuid, $3, $4, $5, 'razorpay', 'pending')
           RETURNING id`,
          [entityId, customerId, vendorId, chargeAmount, currency]
        );
        return { paymentId: String(ins.rows[0].id), razorpayOrderId: null, amount: chargeAmount };
      }

      const o = await client.query(
        `SELECT id, order_status, payment_status, cancellation_reason, payment_method
         FROM orders WHERE id = $1::uuid FOR UPDATE`,
        [entityId]
      );
      if (!o.rows[0]) throw Object.assign(new Error('Order not found'), { httpStatus: 404 });
      const st = String(o.rows[0].order_status || '').toLowerCase();
      const ps = String(o.rows[0].payment_status || '').toLowerCase();
      const pm = String(o.rows[0].payment_method || '').toLowerCase();
      if (ps === 'paid' || ps === 'completed') {
        return { paymentId: '', razorpayOrderId: null, amount: 0, alreadyPaid: true };
      }
      if (pm === 'cod' || pm === 'cash_on_delivery') {
        throw Object.assign(new Error('This order uses cash on delivery; online payment is not required.'), {
          httpStatus: 400,
        });
      }
      if (st === 'cancelled' && !isHoldExpiryCancelReason(o.rows[0].cancellation_reason)) {
        throw Object.assign(new Error('Order payment window has expired or order was cancelled. Please place a new order.'), {
          httpStatus: 410,
        });
      }
      const existing = await client.query(
        `SELECT id, razorpay_order_id, amount
         FROM payments
         WHERE order_id = $1::uuid AND booking_id IS NULL
           AND LOWER(COALESCE(payment_status, '')) IN ('pending', 'processing')
         ORDER BY created_at DESC
         LIMIT 1
         FOR UPDATE`,
        [entityId]
      );
      if (existing.rows[0]) {
        return {
          paymentId: String(existing.rows[0].id),
          razorpayOrderId: existing.rows[0].razorpay_order_id ? String(existing.rows[0].razorpay_order_id) : null,
          amount: Number(existing.rows[0].amount) || chargeAmount,
        };
      }
      const ins = await client.query(
        `INSERT INTO payments (booking_id, order_id, customer_id, vendor_id, amount, currency, payment_method, payment_status)
         VALUES (NULL, $1::uuid, $2::uuid, $3, $4, $5, 'razorpay', 'pending')
         RETURNING id`,
        [entityId, customerId, vendorId, chargeAmount, currency]
      );
      return { paymentId: String(ins.rows[0].id), razorpayOrderId: null, amount: chargeAmount };
    });
  } catch (err: any) {
    if (err?.code === '23505' && depth < 2) {
      return ensurePayableRazorpayOrder(input, depth + 1);
    }
    const status = Number(err?.httpStatus) || 500;
    return { action: 'rejected', error: err?.message || 'Payment order failed', status };
  }

  if (!seed || seed.alreadyPaid) {
    return { action: 'already_paid', razorpayOrderId: seed?.razorpayOrderId || null };
  }

  if (seed.razorpayOrderId) {
    const rzp = await fetchRazorpayOrder(seed.razorpayOrderId);
    if (rzp?.status === 'paid') {
      await finalizeCapturedPayment({
        source: 'create-order',
        razorpayOrderId: seed.razorpayOrderId,
        paymentRowId: seed.paymentId,
      });
      return { action: 'already_paid', razorpayOrderId: seed.razorpayOrderId };
    }
    logPaymentSafety('payment_create', {
      entity_type: kind === 'shop' ? 'shop_order' : 'booking',
      entity_id: entityId,
      payment_attempt_id: seed.paymentId,
      razorpay_order_id: seed.razorpayOrderId,
      reused_existing_order: true,
    });
    return {
      action: 'reuse',
      razorpayOrderId: seed.razorpayOrderId,
      amount: seed.amount,
      currency,
      reused: true,
      paymentId: seed.paymentId,
    };
  }

  const receipt = receiptForPayment(kind, seed.paymentId);
  const orderData: Record<string, unknown> = {
    amount: Math.round(chargeAmount * 100),
    currency,
    receipt,
    notes: input.notes,
  };
  if (input.transfers) orderData.transfers = input.transfers;

  let razorpayOrder: { id?: string; amount?: number; currency?: string };
  try {
    razorpayOrder = (await razorpayRequest('/orders', 'POST', orderData, 20000)) as {
      id?: string;
      amount?: number;
      currency?: string;
    };
  } catch (err: any) {
    const msg = String(err?.message || '');
    if (/receipt/i.test(msg) && /already|exist/i.test(msg)) {
      const found = seed.razorpayOrderId
        ? { id: seed.razorpayOrderId }
        : await fetchRazorpayOrderByReceipt(receipt);
      if (found?.id) {
        await attachRazorpayOrderId(seed.paymentId, found.id, chargeAmount, currency);
        return {
          action: 'reuse',
          razorpayOrderId: found.id,
          amount: seed.amount,
          currency,
          reused: true,
          paymentId: seed.paymentId,
        };
      }
    }
    throw err;
  }

  if (!razorpayOrder?.id) {
    return { action: 'rejected', error: 'Failed to create payment order: Invalid response from Razorpay', status: 500 };
  }

  await attachRazorpayOrderId(seed.paymentId, String(razorpayOrder.id), chargeAmount, currency);

  logPaymentSafety('payment_create', {
    entity_type: kind === 'shop' ? 'shop_order' : 'booking',
    entity_id: entityId,
    payment_attempt_id: seed.paymentId,
    razorpay_order_id: razorpayOrder.id,
    reused_existing_order: false,
    receipt,
  });

  return {
    action: 'created',
    razorpayOrderId: String(razorpayOrder.id),
    amount: (razorpayOrder.amount || Math.round(chargeAmount * 100)) / 100,
    currency: String(razorpayOrder.currency || currency),
    reused: false,
    paymentId: seed.paymentId,
  };
}
