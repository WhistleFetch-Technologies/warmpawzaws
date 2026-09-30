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

export class WpayBookingPaymentInProgressError extends Error {
  constructor() {
    super(
      'An earlier payment for this appointment is still processing. Check Pay Bill history or try again in a few minutes.',
    );
    this.name = 'WpayBookingPaymentInProgressError';
  }
}

const STALE_WALLET_ATTEMPT_MS = 2 * 60 * 1000;
const SUPERSEDED_REASON = 'superseded_stale_pay_bill';

/** A Razorpay order is abandoned when it has no payment attempts, or every attempt failed. */
export function isAbandonedRazorpayOrder(
  payments: Array<{ status?: string | null }> | null | undefined,
): boolean {
  const items = Array.isArray(payments) ? payments : [];
  return items.every((p) => String(p?.status ?? '').toLowerCase() === 'failed');
}

type ActiveBookingPaymentRow = {
  id: string;
  razorpay_order_id: string | null;
  payment_source: string | null;
  customer_id: string | null;
  created_at: string | Date | null;
};

/**
 * One payable attempt per booking (idx_payments_one_active_per_booking). A new credited Pay Bill
 * may replace this customer's earlier Pay Bill attempt only when Razorpay shows nothing in flight.
 */
async function supersedeStaleBookingPayBill(params: {
  bookingId: string;
  customerId: string;
  idempotencyKey: string;
}): Promise<void> {
  const active = await query(
    `SELECT id::text AS id, razorpay_order_id, payment_source, customer_id::text AS customer_id, created_at
     FROM payments
     WHERE booking_id = $1::uuid
       AND LOWER(COALESCE(payment_status, '')) IN ('pending', 'processing')
       AND idempotency_key IS DISTINCT FROM $2
     LIMIT 1`,
    [params.bookingId, params.idempotencyKey],
  );
  const row = active.rows[0] as ActiveBookingPaymentRow | undefined;
  if (!row?.id) return;
  if (row.payment_source !== 'warmpawz_pay' || row.customer_id !== params.customerId) {
    throw new WpayBookingPaymentInProgressError();
  }

  if (row.razorpay_order_id) {
    let attempts: Array<{ status?: string }> | undefined;
    try {
      const res = (await razorpayRequest(
        `/orders/${encodeURIComponent(row.razorpay_order_id)}/payments`,
        'GET',
        undefined,
        10000,
      )) as { items?: Array<{ status?: string }> };
      attempts = res?.items ?? [];
    } catch {
      throw new WpayBookingPaymentInProgressError();
    }
    if (!isAbandonedRazorpayOrder(attempts)) {
      throw new WpayBookingPaymentInProgressError();
    }
  } else {
    const createdMs = row.created_at ? new Date(row.created_at).getTime() : 0;
    if (Number.isFinite(createdMs) && Date.now() - createdMs < STALE_WALLET_ATTEMPT_MS) {
      throw new WpayBookingPaymentInProgressError();
    }
  }

  await query(
    `UPDATE payments
     SET payment_status = 'failed',
         failure_reason = COALESCE(NULLIF(BTRIM(failure_reason), ''), $2),
         updated_at = NOW()
     WHERE id = $1::uuid
       AND LOWER(COALESCE(payment_status, '')) IN ('pending', 'processing')`,
    [row.id, SUPERSEDED_REASON],
  );
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
  metadata?: Record<string, unknown> | null;
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
    `SELECT id::text AS id, razorpay_order_id, amount, currency, payment_status, metadata
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
  const metaCharge = Number(row.metadata?.razorpayChargeAmount);
  const pendingAmt = Number.isFinite(metaCharge) && metaCharge > 0
    ? metaCharge
    : Number(row.amount ?? fallbackAmount);
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
  /** Cash charged on Razorpay. Defaults to payableAmount. */
  chargeAmount?: number;
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
  const chargeAmt =
    params.chargeAmount != null
      ? Math.round(Number(params.chargeAmount) * 100) / 100
      : amt;
  if (!Number.isFinite(amt) || amt <= 0) {
    throw new Error('Invalid payable amount');
  }
  if (!Number.isFinite(chargeAmt) || chargeAmt <= 0) {
    throw new Error('Invalid Razorpay charge amount');
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
  const pendingReuse = existing ? reusePendingOrder(existing, config.keyId, chargeAmt) : null;
  if (pendingReuse) return pendingReuse;

  const quotedOriginal =
    quoteMetadata.quotedOriginalAmount ?? quoteMetadata.quotedAmount ?? amt;

  const receipt = `wpay_${String(Date.now())}`.slice(0, 40);
  const orderData = {
    amount: Math.round(chargeAmt * 100),
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

  const insertPending = async () => {
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
        razorpayChargeAmount: chargeAmt,
        quotedPayableAmount: amt,
      },
    });
    const row = Array.isArray(payRows) ? payRows[0] : payRows;
    const paymentId = row?.id != null ? String(row.id) : '';
    if (!paymentId) {
      throw new Error('Failed to create payment row');
    }
    return {
      orderId: razorpayOrder.id!,
      amount: (razorpayOrder.amount ?? Math.round(chargeAmt * 100)) / 100,
      amountPaise: razorpayOrder.amount ?? Math.round(chargeAmt * 100),
      currency: razorpayOrder.currency || 'INR',
      keyId: config.keyId,
      paymentId,
    };
  };

  try {
    return await insertPending();
  } catch (error: unknown) {
    if (!isUniqueViolation(error)) throw error;

    const raced = await findWpayPaymentByIdempotency({
      idempotencyKey,
      vendorId,
      customerId,
    });
    assertNotCompleted(raced);
    const racedPending = raced ? reusePendingOrder(raced, config.keyId, chargeAmt) : null;
    if (racedPending) return racedPending;

    if (!bookingId) {
      throw new Error(
        'A payment for this request already exists. Close checkout and start Pay Bill again.',
      );
    }
    await supersedeStaleBookingPayBill({ bookingId, customerId, idempotencyKey });
    try {
      return await insertPending();
    } catch (retryError: unknown) {
      if (isUniqueViolation(retryError)) throw new WpayBookingPaymentInProgressError();
      throw retryError;
    }
  }
}

/** Wallet covers the full Pay Bill — no Razorpay order. */
export async function createWpayWalletOnlyPayment(params: {
  customerId: string;
  vendorId: string;
  payableAmount: number;
  bookingId?: string | null;
  clientRequestId?: string | null;
  quoteMetadata: Record<string, unknown>;
}): Promise<{ paymentId: string; amount: number }> {
  const amt = Math.round(Number(params.payableAmount) * 100) / 100;
  if (!Number.isFinite(amt) || amt <= 0) {
    throw new Error('Invalid payable amount');
  }
  const clientRequestId = normalizeWpayClientRequestId(params.clientRequestId);
  const idempotencyKey = buildWpayIdempotencyKey({
    customerId: params.customerId,
    vendorId: params.vendorId,
    clientRequestId,
  });
  const existing = await findWpayPaymentByIdempotency({
    idempotencyKey,
    vendorId: params.vendorId,
    customerId: params.customerId,
  });
  assertNotCompleted(existing);
  if (existing?.id && String(existing.payment_status ?? '').toLowerCase() === 'pending') {
    return { paymentId: String(existing.id), amount: amt };
  }

  const quotedOriginal =
    params.quoteMetadata.quotedOriginalAmount ?? params.quoteMetadata.quotedAmount ?? amt;
  const discountAmount = Number(params.quoteMetadata.quotedDiscountAmount ?? 0);
  const originalAmount = Number(quotedOriginal);

  const insertPending = () =>
    insert('payments', {
      booking_id: params.bookingId ?? null,
      customer_id: params.customerId,
      vendor_id: params.vendorId,
      razorpay_order_id: null,
      amount: amt,
      original_amount: Number.isFinite(originalAmount) ? originalAmount : amt,
      discount_amount: Number.isFinite(discountAmount) ? discountAmount : 0,
      currency: 'INR',
      payment_method: 'wallet',
      payment_status: 'pending',
      payment_source: 'warmpawz_pay',
      idempotency_key: idempotencyKey,
      metadata: {
        ...params.quoteMetadata,
        clientRequestId,
        razorpayChargeAmount: 0,
        quotedPayableAmount: amt,
        walletOnly: true,
      },
    });

  let payRows: unknown;
  try {
    payRows = await insertPending();
  } catch (error: unknown) {
    if (!isUniqueViolation(error) || !params.bookingId) throw error;
    const raced = await findWpayPaymentByIdempotency({
      idempotencyKey,
      vendorId: params.vendorId,
      customerId: params.customerId,
    });
    assertNotCompleted(raced);
    if (raced?.id && String(raced.payment_status ?? '').toLowerCase() === 'pending') {
      return { paymentId: String(raced.id), amount: amt };
    }
    await supersedeStaleBookingPayBill({
      bookingId: params.bookingId,
      customerId: params.customerId,
      idempotencyKey,
    });
    try {
      payRows = await insertPending();
    } catch (retryError: unknown) {
      if (isUniqueViolation(retryError)) throw new WpayBookingPaymentInProgressError();
      throw retryError;
    }
  }
  const row = (Array.isArray(payRows) ? payRows[0] : payRows) as { id?: unknown } | undefined;
  const paymentId = row?.id != null ? String(row.id) : '';
  if (!paymentId) {
    throw new Error('Failed to create payment row');
  }
  return { paymentId, amount: amt };
}

