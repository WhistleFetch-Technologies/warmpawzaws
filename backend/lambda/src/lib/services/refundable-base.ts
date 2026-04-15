/**
 * Refund tier math should apply to **what the customer actually paid** (net of coupon/promo),
 * not necessarily `bookings.total_amount` when that row still reflects pre-discount list totals.
 *
 * Priority:
 *  1) SUM(payments.amount) for completed captures linked to the booking (authoritative when present).
 *  2) bookings.total_amount − COALESCE(bookings.discount_amount, 0) when discount was persisted.
 *  3) bookings.total_amount alone.
 */

import { query } from '../../database/rds-connection';

export type BookingMoneySnapshot = {
  total_amount?: number | string | null;
  discount_amount?: number | string | null;
};

function roundMoney(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
}

/**
 * Total customer money captured for this booking (Razorpay + wallet-as-single-row flows).
 */
export async function getRefundableCustomerPaidBaseAmount(
  bookingId: string,
  bookingRow?: BookingMoneySnapshot | null
): Promise<number> {
  if (!bookingId) return 0;

  const paidRes = await query(
    `SELECT COALESCE(SUM(amount::numeric), 0)::text AS paid
     FROM payments
     WHERE booking_id = $1::uuid
       AND payment_status = 'completed'`,
    [bookingId]
  ).catch(() => ({ rows: [] as { paid?: string }[] }));

  const fromPayments = parseFloat(String((paidRes as any).rows?.[0]?.paid ?? '0')) || 0;

  const gross = parseFloat(String(bookingRow?.total_amount ?? 0)) || 0;
  const disc = parseFloat(String(bookingRow?.discount_amount ?? 0)) || 0;
  const fromBookingNet = Math.max(0, gross - disc);

  if (fromPayments > 0) {
    if (gross > 0 && fromPayments > gross + 0.01) {
      return roundMoney(gross);
    }
    return roundMoney(fromPayments);
  }

  if (fromBookingNet > 0) {
    return roundMoney(fromBookingNet);
  }

  return roundMoney(gross);
}
