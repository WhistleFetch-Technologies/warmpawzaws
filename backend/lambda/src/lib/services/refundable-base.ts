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

  const gross = parseFloat(String(bookingRow?.total_amount ?? 0)) || 0;
  const disc = parseFloat(String(bookingRow?.discount_amount ?? 0)) || 0;
  const fromBookingNet = Math.max(0, gross - disc);

  const paymentTotals = await loadCompletedPaymentTotals(bookingId);

  if (paymentTotals && paymentTotals.paidTotal > 0) {
    const { paidTotal, platformFeeTotal, refundableFromPayments } = paymentTotals;
    if (gross > 0 && paidTotal > gross + 0.01) {
      const pfCapped = Math.min(platformFeeTotal, gross);
      const refundableCapped = Math.max(0, gross - pfCapped);
      return {
        refundableBase: roundMoney(refundableCapped),
        platformFeeNonRefundable: roundMoney(pfCapped),
      };
    }
    return {
      refundableBase: roundMoney(refundableFromPayments),
      platformFeeNonRefundable: roundMoney(platformFeeTotal),
    };
  }

  if (fromBookingNet > 0) {
    return { refundableBase: roundMoney(fromBookingNet), platformFeeNonRefundable: 0 };
  }

  return { refundableBase: roundMoney(gross), platformFeeNonRefundable: 0 };
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
