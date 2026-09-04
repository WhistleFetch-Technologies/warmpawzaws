import { createHmac, createHash, randomUUID } from 'crypto';
import { insert, query } from '../database/rds-connection';
import { getRazorpayConfig, razorpayRequest } from './payments/razorpay-client';

export class WpayPaymentAlreadyCompletedError extends Error {
  readonly paymentId: string;

  constructor(paymentId: string) {
    super('This payment was already completed. Start a new Pay Bill to pay again.');
    this.name = 'WpayPaymentAlreadyCompletedError';
    this.paymentId = paymentId;
  }
}

const CLIENT_REQUEST_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeWpayClientRequestId(raw?: string | null): string {
  const trimmed = String(raw ?? '').trim();
  if (CLIENT_REQUEST_ID_RE.test(trimmed)) return trimmed.toLowerCase();
  return randomUUID();
}

/** One checkout attempt per (customer, vendor, clientRequestId). */
export function buildWpayIdempotencyKey(params: {
  customerId: string;
  vendorId: string;
  clientRequestId: string;
}): string {
  return createHash('sha256')
    .update(`${params.customerId}|${params.vendorId}|${params.clientRequestId}`)
    .digest('hex');
}

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

type ExistingWpayPaymentRow = {
  id?: string;
  razorpay_order_id?: string;
  amount?: number;
  currency?: string;
  payment_status?: string;
};

function isUniqueViolation(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      String((error as { code?: string }).code) === '23505',
  );
}

async function findWpayPaymentByIdempotency(params: {
  idempotencyKey: string;
  vendorId: string;
  customerId: string;
}): Promise<ExistingWpayPaymentRow | undefined> {
  const existing = await query(
    `SELECT id::text AS id, razorpay_order_id, amount, currency, payment_status
     FROM payments
     WHERE idempotency_key = $1
       AND payment_source = 'warmpawz_pay'
       AND vendor_id = $2::uuid
       AND customer_id = $3::uuid
     ORDER BY
       CASE WHEN payment_status = 'pending' THEN 0 ELSE 1 END,
       created_at DESC
     LIMIT 1`,
    [params.idempotencyKey, params.vendorId, params.customerId],
  );
  return existing.rows[0] as ExistingWpayPaymentRow | undefined;
}

function reusePendingOrder(
  row: ExistingWpayPaymentRow,
  keyId: string,
  fallbackAmount: number,
): {
  orderId: string;
  amount: number;
  amountPaise: number;
  currency: string;
  keyId: string;
  paymentId: string;
} | null {
  if (
    String(row.payment_status ?? '').toLowerCase() !== 'pending' ||
    !row.id ||
    !row.razorpay_order_id
  ) {
    return null;
  }
  const pendingAmt = Number(row.amount ?? fallbackAmount);
  return {
    orderId: String(row.razorpay_order_id),
    amount: pendingAmt,
    amountPaise: Math.round(pendingAmt * 100),
    currency: row.currency || 'INR',
    keyId,
    paymentId: String(row.id),
  };
}

function assertNotCompleted(row: ExistingWpayPaymentRow | undefined): void {
  if (!row?.id) return;
  const status = String(row.payment_status ?? '').toLowerCase();
  if (status === 'completed' || status === 'paid' || status === 'success') {
    throw new WpayPaymentAlreadyCompletedError(String(row.id));
  }
}

export async function createWpayRazorpayOrder(params: {
  customerId: string;
  vendorId: string;
  payableAmount: number;
  bookingId?: string | null;
  clientRequestId?: string | null;
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

  const clientRequestId = normalizeWpayClientRequestId(params.clientRequestId);
  const idempotencyKey = buildWpayIdempotencyKey({
    customerId,
    vendorId,
    clientRequestId,
  });

  const existing = await findWpayPaymentByIdempotency({
    idempotencyKey,
    vendorId,
    customerId,
  });
  assertNotCompleted(existing);
  const pendingReuse = existing ? reusePendingOrder(existing, config.keyId, amt) : null;
  if (pendingReuse) return pendingReuse;

  const quotedOriginal =
    quoteMetadata.quotedOriginalAmount ?? quoteMetadata.quotedAmount ?? amt;

  const receipt = `wpay_${String(Date.now())}`.slice(0, 40);
  const orderData = {
    amount: Math.round(amt * 100),
    currency: 'INR',
    receipt,
    notes: {
      type: 'warmpawz_pay',
      customerId: String(customerId),
      vendorId: String(vendorId),
      clientRequestId,
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

  try {
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
      metadata: {
        ...quoteMetadata,
        clientRequestId,
      },
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
  } catch (error: unknown) {
    if (!isUniqueViolation(error)) throw error;

    const raced = await findWpayPaymentByIdempotency({
      idempotencyKey,
      vendorId,
      customerId,
    });
    assertNotCompleted(raced);
    const racedPending = raced ? reusePendingOrder(raced, config.keyId, amt) : null;
    if (racedPending) return racedPending;

    throw new Error(
      'A payment for this request already exists. Close checkout and start Pay Bill again.',
    );
  }
}
