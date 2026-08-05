import {
  normalizeCustomerCancellationRefundMethod,
  previewCustomerCancellationRefundByMethod,
  type BookingForPolicy,
} from '../../../lib/services/cancellation-policy-service';
import { hasCustomerPaidCapture } from '../../../lib/services/refundable-base';
import { computeHoursUntilBookingStart } from '../../../lib/utils/booking-start-wall-time';
import { creditCustomerWalletForBookingRefund } from '../../../utils/credit-customer-wallet';
import { processBookingOriginalPaymentRefund } from '../../../utils/payments/booking-original-refund';
import { query } from '../../../database/rds-connection';
import {
  dbMarkBookingCancelled,
  rowToBookingForPolicy,
} from '../../customer/warmpawz-appointments/repos/wappt_booking_policy.repo';
import { isWapptPolicyEligibleBooking } from './wappt-policy.constants';

export function assertWapptBookingEligible(row: Record<string, unknown>) {
  if (!isWapptPolicyEligibleBooking(row as any)) {
    const err = new Error(
      'Booking is not eligible for Warmpawz Appointments policy endpoints. Use marketplace cancel/refund APIs.',
    );
    (err as any).status = 409;
    throw err;
  }
}

export async function previewWapptCustomerCancellationRefund(
  bookingRow: Record<string, unknown>,
  refundMethodRaw: unknown,
) {
  const booking = rowToBookingForPolicy(bookingRow) as BookingForPolicy;
  const refundMethod = normalizeCustomerCancellationRefundMethod(refundMethodRaw);
  return previewCustomerCancellationRefundByMethod(booking, refundMethod);
}

export async function executeWapptCustomerCancel(opts: {
  bookingRow: Record<string, unknown>;
  reason?: string;
  refundMethodRaw?: unknown;
}) {
  assertWapptBookingEligible(opts.bookingRow);
  const bookingId = String(opts.bookingRow.booking_id ?? opts.bookingRow.id);
  const customerId = String(opts.bookingRow.customer_id ?? '');
  const reason = opts.reason?.trim() || 'No reason provided';

  const hoursUntilStart = computeHoursUntilBookingStart(rowToBookingForPolicy(opts.bookingRow));
  if (Number.isFinite(hoursUntilStart) && hoursUntilStart < 0) {
    const err = new Error('Cannot cancel past appointments');
    (err as any).status = 400;
    throw err;
  }

  const updated = await dbMarkBookingCancelled(bookingId, reason, 'pet_parent');
  if (!updated) {
    const err = new Error('Booking not found or cannot be cancelled');
    (err as any).status = 404;
    throw err;
  }

  let refundInfo: Record<string, unknown> | null = null;
  const hasPaid = await hasCustomerPaidCapture(bookingId, {
    total_amount: opts.bookingRow.total_amount as number | string,
    discount_amount: opts.bookingRow.discount_amount as number | string | null,
    payment_status: opts.bookingRow.payment_status as string | null,
  });

  if (hasPaid) {
    const refundMethod = normalizeCustomerCancellationRefundMethod(opts.refundMethodRaw);
    const preview = await previewWapptCustomerCancellationRefund(opts.bookingRow, refundMethod);
    const refundAmount = Math.round(preview.refundAmount * 100) / 100;
    if (refundAmount > 0) {
      if (refundMethod === 'wallet') {
        await creditCustomerWalletForBookingRefund({
          customerId,
          bookingId,
          refundAmount,
          refundPercentage: preview.refundPercentage,
          label: 'appointment',
        });
        refundInfo = {
          amount: refundAmount,
          percentage: preview.refundPercentage,
          method: 'wallet',
          status: 'completed',
          message: `₹${refundAmount.toFixed(2)} credited to wallet`,
        };
      } else {
        await processBookingOriginalPaymentRefund({
          bookingId,
          customerId,
          refundAmount,
          refundPercentage: preview.refundPercentage,
          reason: `WAPPT cancellation: ${reason} (${preview.refundPercentage}% refund)`,
        });
        refundInfo = {
          amount: refundAmount,
          percentage: preview.refundPercentage,
          method: 'original',
          status: 'completed',
          message: `₹${refundAmount.toFixed(2)} refund initiated to original payment method`,
        };
      }
    }
  }

  await query(
    `INSERT INTO booking_status_history (booking_id, status, notes, created_at)
     VALUES ($1::uuid, 'cancelled', $2, NOW())`,
    [bookingId, reason],
  ).catch(() => undefined);

  return { booking: updated, refund: refundInfo, message: 'Appointment cancelled successfully' };
}
