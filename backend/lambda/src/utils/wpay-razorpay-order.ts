import { createHmac, createHash } from 'crypto';
import { insert, query } from '../database/rds-connection';
import { getRazorpayConfig, razorpayRequest } from './payments/razorpay-client';
import { ymdInIst } from './ist-scheduling';

export function verifyWpayRazorpaySignature(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  razorpaySignature: string,
  keySecret: string,
): boolean {
  const text = `${razorpayOrderId}|${razorpayPaymentId}`;
  const generated = createHmac('sha256', keySecret).update(text).digest('hex');
  return generated === String(razorpaySignature || '').trim();
}

export async function createWpayRazorpayOrder(params: {
  customerId: string;
  vendorId: string;
  payableAmount: number;
  bookingId?: string | null;
  quoteMetadata: Record<string, unknown>;
}): Promise<{
  orderId: string;
  amount: number;
  amountPaise: number;
  currency: string;
  keyId: string;
  paymentId: string;
}> {
  const { customerId, vendorId, payableAmount, bookingId, quoteMetadata } = params;
  const config = await getRazorpayConfig();
  if (!config?.keyId || !config?.keySecret) {
    throw new Error('Razorpay is not configured');
  }

  const amt = Math.round(Number(payableAmount) * 100) / 100;
  if (!Number.isFinite(amt) || amt <= 0) {
    throw new Error('Invalid payable amount');
  }

  const quotedOriginal =
    quoteMetadata.quotedOriginalAmount ?? quoteMetadata.quotedAmount ?? amt;
  const idempotencyKey = createHash('sha256')
    .update(
      `${customerId}|${vendorId}|${bookingId ?? 'walkin'}|${quotedOriginal}|${ymdInIst()}`,
    )
    .digest('hex');

  const pendingReuse = await query(
    `SELECT id::text AS id, razorpay_order_id, amount, currency
     FROM payments
     WHERE idempotency_key = $1
       AND payment_source = 'warmpawz_pay'
       AND payment_status = 'pending'
       AND vendor_id = $2::uuid
       AND customer_id = $3::uuid
     LIMIT 1`,
    [idempotencyKey, vendorId, customerId],
  );
  const pendingRow = pendingReuse.rows[0] as
    | { id?: string; razorpay_order_id?: string; amount?: number; currency?: string }
    | undefined;
  if (pendingRow?.id && pendingRow.razorpay_order_id) {
    const pendingAmt = Number(pendingRow.amount ?? amt);
    return {
      orderId: String(pendingRow.razorpay_order_id),
      amount: pendingAmt,
      amountPaise: Math.round(pendingAmt * 100),
      currency: pendingRow.currency || 'INR',
      keyId: config.keyId,
      paymentId: String(pendingRow.id),
    };
  }

  const receipt = `wpay_${String(Date.now())}`.slice(0, 40);
  const orderData = {
    amount: Math.round(amt * 100),
    currency: 'INR',
    receipt,
    notes: {
      type: 'warmpawz_pay',
      customerId: String(customerId),
      vendorId: String(vendorId),
    },
  };

  const razorpayOrder = (await razorpayRequest('/orders', 'POST', orderData, 20000)) as {
    id?: string;
    amount?: number;
    currency?: string;
  };
  if (!razorpayOrder?.id) {
    throw new Error('Failed to create Razorpay order');
  }

  const discountAmount = Number(quoteMetadata.quotedDiscountAmount ?? 0);
  const originalAmount = Number(quotedOriginal);

  const payRows = await insert('payments', {
    booking_id: bookingId ?? null,
    customer_id: customerId,
    vendor_id: vendorId,
    razorpay_order_id: razorpayOrder.id,
    amount: amt,
    original_amount: Number.isFinite(originalAmount) ? originalAmount : amt,
    discount_amount: Number.isFinite(discountAmount) ? discountAmount : 0,
    currency: 'INR',
    payment_method: 'razorpay',
    payment_status: 'pending',
    payment_source: 'warmpawz_pay',
    idempotency_key: idempotencyKey,
    metadata: quoteMetadata,
  });

  const row = Array.isArray(payRows) ? payRows[0] : payRows;
  const paymentId = row?.id != null ? String(row.id) : '';
  if (!paymentId) {
    throw new Error('Failed to create payment row');
  }

  return {
    orderId: razorpayOrder.id,
    amount: (razorpayOrder.amount ?? Math.round(amt * 100)) / 100,
    amountPaise: razorpayOrder.amount ?? Math.round(amt * 100),
    currency: razorpayOrder.currency || 'INR',
    keyId: config.keyId,
    paymentId,
  };
}
