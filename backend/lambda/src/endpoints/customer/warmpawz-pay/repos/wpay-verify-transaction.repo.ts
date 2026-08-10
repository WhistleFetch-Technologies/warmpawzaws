import type { PoolClient } from 'pg';
import { withTransaction } from '../../../../database/rds-connection';
import type { WpayPaymentRow } from './wpay-payment.repo';

export class WpayCreditConsumeConflictError extends Error {
  constructor(message = 'Appointment fee credit already used') {
    super(message);
    this.name = 'WpayCreditConsumeConflictError';
  }
}

async function consumeCreditInTransaction(
  client: PoolClient,
  params: { bookingId: string; paymentId: string; amount: number },
): Promise<boolean> {
  const insert = await client.query(
    `INSERT INTO warmpawz_pay_appointment_credits (booking_id, payment_id, amount)
     VALUES ($1::uuid, $2::uuid, $3::numeric)
     ON CONFLICT (booking_id) DO NOTHING
     RETURNING booking_id`,
    [params.bookingId, params.paymentId, params.amount],
  );
  if (insert.rows.length > 0) {
    return true;
  }

  const existing = await client.query(
    `SELECT payment_id::text AS payment_id
     FROM warmpawz_pay_appointment_credits
     WHERE booking_id = $1::uuid
     LIMIT 1`,
    [params.bookingId],
  );
  const ownerPaymentId = String(existing.rows[0]?.payment_id ?? '');
  if (ownerPaymentId && ownerPaymentId === params.paymentId) {
    return false;
  }
  throw new WpayCreditConsumeConflictError();
}

async function completePaymentInTransaction(
  client: PoolClient,
  params: {
    paymentId: string;
    customerId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
    originalAmount: number;
    discountAmount: number;
  },
): Promise<WpayPaymentRow | null> {
  const result = await client.query(
    `UPDATE payments
     SET payment_status = 'completed',
         razorpay_payment_id = $3,
         razorpay_signature = $4,
         original_amount = $5,
         discount_amount = $6,
         completed_at = COALESCE(completed_at, NOW()),
         updated_at = NOW()
     WHERE id = $1::uuid
       AND customer_id = $2::uuid
       AND payment_source = 'warmpawz_pay'
       AND payment_status IN ('pending', 'processing', 'completed')
     RETURNING id, customer_id, vendor_id, booking_id, amount, original_amount, discount_amount,
               payment_status, razorpay_order_id, razorpay_payment_id, razorpay_signature,
               metadata, completed_at, created_at`,
    [
      params.paymentId,
      params.customerId,
      params.razorpayPaymentId,
      params.razorpaySignature,
      params.originalAmount,
      params.discountAmount,
    ],
  );
  return (result.rows[0] as WpayPaymentRow | undefined) ?? null;
}

export async function dbWpayAtomicCompleteVerify(params: {
  paymentId: string;
  customerId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  originalAmount: number;
  discountAmount: number;
  bookingId?: string | null;
  creditAmount?: number;
}): Promise<WpayPaymentRow | null> {
  return withTransaction(async (client) => {
    const creditAmount = params.creditAmount ?? 0;
    const bookingId = params.bookingId ? String(params.bookingId) : '';

    // Consume cover credit only — appointment completion is owned by vendor complete OTP.
    if (bookingId && creditAmount > 0) {
      await consumeCreditInTransaction(client, {
        bookingId,
        paymentId: params.paymentId,
        amount: creditAmount,
      });
    }

    return completePaymentInTransaction(client, params);
  });
}
