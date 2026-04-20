/**
 * Refund tier math applies to **what the customer can get back** for the service/net amount:
 * - Prefer completed **payments** for the booking.
 * - **Platform fee** on each payment is never refundable (excluded from the base used for % refunds).
 * - **Coupons / promos**: net of `discount_amount` on the booking when no payment rows exist.
 *
 * Priority for refundable base:
 *  1) SUM(amount − platform_fee) for completed captures (authoritative when present).
 *  2) bookings.total_amount − COALESCE(bookings.discount_amount, 0) when no payments.
 *  3) bookings.total_amount alone.
 */

import { query } from '../../database/rds-connection';

export type BookingMoneySnapshot = {
  total_amount?: number | string | null;
  discount_amount?: number | string | null;
  /** When set (e.g. from bookings row), used for cancel/refund gating with wallet + payment rows. */
  payment_status?: string | null;
};

export type RefundablePaidBreakdown = {
  /** Amount refund % / fees apply to (paid captures minus non-refundable platform fees). */
  refundableBase: number;
  /** Sum of platform_fee on completed payments for this booking (for UI / disclosure). */
  platformFeeNonRefundable: number;
};

function roundMoney(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
}

/** Wallet applied to the booking (split-pay / wallet-only), not in Razorpay `payments.amount`. */
async function loadWalletDebitTotalForBooking(bookingId: string): Promise<number> {
  if (!bookingId) return 0;
  let cols: Set<string>;
  try {
    const meta = await query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'wallet_transactions'`
    );
    cols = new Set((meta as any).rows?.map((r: { column_name: string }) => r.column_name) ?? []);
  } catch {
    return 0;
  }

  const hasBookingId = cols.has('booking_id');
  const hasReferenceId = cols.has('reference_id');
  const hasReferenceType = cols.has('reference_type');

  const bookingMatch =
    hasBookingId ?
      `(booking_id = $1::uuid AND (
          ${hasReferenceType ? `COALESCE(reference_type, '') IN ('booking_payment', 'payment', 'booking', '')` : 'TRUE'}
          OR description ILIKE '%Payment for booking%'
        ))`
    : 'FALSE';

  const refMatch =
    hasReferenceId ?
      `(reference_id = $1::uuid AND (
          ${hasReferenceType ? `COALESCE(reference_type, '') IN ('booking_payment', 'payment', 'booking', '')` : 'TRUE'}
        ))`
    : 'FALSE';

  const descMatch = `(transaction_type = 'debit' AND description = 'Payment for booking ' || $1::text)`;

  const whereCore = [bookingMatch, refMatch, descMatch].filter((s) => s !== 'FALSE').join(' OR ');
  if (!whereCore || whereCore === 'FALSE') {
    return 0;
  }

  try {
    const res = await query(
      `SELECT COALESCE(SUM(amount::numeric), 0)::text AS w
       FROM wallet_transactions
       WHERE transaction_type = 'debit'
         AND (${whereCore})`,
      [bookingId]
    );
    const row = (res as any).rows?.[0];
    return parseFloat(String(row?.w ?? '0')) || 0;
  } catch {
    return 0;
  }
}

async function loadCompletedPaymentTotals(bookingId: string): Promise<{
  paidTotal: number;
  platformFeeTotal: number;
  refundableFromPayments: number;
} | null> {
  if (!bookingId) return null;
  try {
    const paidRes = await query(
      `SELECT
         COALESCE(SUM(amount::numeric), 0)::text AS paid_total,
         COALESCE(SUM(COALESCE(platform_fee, 0)::numeric), 0)::text AS platform_fee_total,
         COALESCE(SUM((amount::numeric - COALESCE(platform_fee, 0)::numeric)), 0)::text AS refundable_from_payments
       FROM payments
       WHERE booking_id = $1::uuid
         AND payment_status = 'completed'`,
      [bookingId]
    );
    const row = (paidRes as any).rows?.[0];
    if (!row) return null;
    return {
      paidTotal: parseFloat(String(row.paid_total ?? '0')) || 0,
      platformFeeTotal: parseFloat(String(row.platform_fee_total ?? '0')) || 0,
      refundableFromPayments: parseFloat(String(row.refundable_from_payments ?? '0')) || 0,
    };
  } catch {
    try {
      const paidRes = await query(
        `SELECT COALESCE(SUM(amount::numeric), 0)::text AS paid_total
         FROM payments
         WHERE booking_id = $1::uuid
           AND payment_status = 'completed'`,
        [bookingId]
      );
      const row = (paidRes as any).rows?.[0];
      const paidTotal = parseFloat(String(row?.paid_total ?? '0')) || 0;
      return {
        paidTotal,
        platformFeeTotal: 0,
        refundableFromPayments: paidTotal,
      };
    } catch {
      return null;
    }
  }
}

/**
 * Paid totals for refund math and platform-fee disclosure.
 */
export async function getRefundableCustomerPaidBreakdown(
  bookingId: string,
  bookingRow?: BookingMoneySnapshot | null
): Promise<RefundablePaidBreakdown> {
  if (!bookingId) {
    return { refundableBase: 0, platformFeeNonRefundable: 0 };
  }

  const br = bookingRow as BookingMoneySnapshot & {
    totalAmount?: number | string | null;
    discountAmount?: number | string | null;
  } | null | undefined;
  const gross = parseFloat(String(br?.total_amount ?? br?.totalAmount ?? 0)) || 0;
  const disc = parseFloat(String(br?.discount_amount ?? br?.discountAmount ?? 0)) || 0;
  const fromBookingNet = Math.max(0, gross - disc);

  const paymentTotals = await loadCompletedPaymentTotals(bookingId);
  const walletPaid = await loadWalletDebitTotalForBooking(bookingId);

  if (paymentTotals && (paymentTotals.paidTotal > 0 || walletPaid > 0)) {
    const { paidTotal, platformFeeTotal, refundableFromPayments } = paymentTotals;
    const combinedRefundable = roundMoney(refundableFromPayments + walletPaid);
    if (gross > 0 && paidTotal > gross + 0.01) {
      const pfCapped = Math.min(platformFeeTotal, gross);
      const refundableCapped = Math.max(0, gross - pfCapped);
      return {
        refundableBase: roundMoney(Math.min(combinedRefundable, refundableCapped)),
        platformFeeNonRefundable: roundMoney(pfCapped),
      };
    }
    return {
      refundableBase: combinedRefundable,
      platformFeeNonRefundable: roundMoney(platformFeeTotal),
    };
  }

  if (walletPaid > 0) {
    const cap = fromBookingNet > 0 ? fromBookingNet : gross;
    const base = cap > 0 ? Math.min(walletPaid, cap) : walletPaid;
    return { refundableBase: roundMoney(base), platformFeeNonRefundable: 0 };
  }

  if (fromBookingNet > 0) {
    return { refundableBase: roundMoney(fromBookingNet), platformFeeNonRefundable: 0 };
  }

  return { refundableBase: roundMoney(gross), platformFeeNonRefundable: 0 };
}

/**
 * Whether the customer has money at stake for this booking: booking marked paid/completed,
 * any wallet debit tied to the booking, or any completed payment row.
 * Used so cancellation can refund wallet/Razorpay even when `bookings.payment_status` was not
 * updated yet (e.g. wallet debited, Razorpay still pending) or when the row uses `completed`.
 */
export async function hasCustomerPaidCapture(
  bookingId: string,
  bookingRow?: BookingMoneySnapshot | null
): Promise<boolean> {
  if (!bookingId) return false;
  const row = bookingRow as BookingMoneySnapshot & { paymentStatus?: string | null } | null | undefined;
  const ps = String(row?.payment_status ?? row?.paymentStatus ?? '').toLowerCase();
  if (ps === 'paid' || ps === 'completed') return true;
  const walletPaid = await loadWalletDebitTotalForBooking(bookingId);
  if (walletPaid > 0.009) return true;
  try {
    const payRes = await query(
      `SELECT 1 FROM payments WHERE booking_id = $1::uuid AND payment_status = 'completed' LIMIT 1`,
      [bookingId]
    );
    const pr = payRes as { rows?: unknown[] };
    return Array.isArray(pr.rows) && pr.rows.length > 0;
  } catch {
    return false;
  }
}

/**
 * @deprecated Prefer getRefundableCustomerPaidBreakdown when platform fee disclosure is needed.
 */
export async function getRefundableCustomerPaidBaseAmount(
  bookingId: string,
  bookingRow?: BookingMoneySnapshot | null
): Promise<number> {
  const b = await getRefundableCustomerPaidBreakdown(bookingId, bookingRow);
  return b.refundableBase;
}

/**
 * Refund line must never exceed what the customer can get back (coupon-adjusted / net of platform fee base).
 * If paid base is unknown (0), returns the proposed refund unchanged.
 */
export function clampRefundToCustomerPaidBase(proposedRefund: number, paidBase: number): number {
  const r = roundMoney(proposedRefund);
  if (!Number.isFinite(r) || r <= 0) return 0;
  const b = roundMoney(paidBase);
  if (!Number.isFinite(b) || b <= 0) return r;
  return roundMoney(Math.min(r, b));
}
