/**
 * Provider-initiated booking cancellation: validate admin refund-tier reason slug,
 * preview refund from vendor_refund_tiers, apply wallet or original-method refund request.
 */

import { query } from '../../database/rds-connection';
import { creditCustomerWalletForBookingRefund } from '../../utils/credit-customer-wallet';
import {
  previewProviderCancellationRefund,
  type BookingForPolicy,
} from './cancellation-policy-service';
import { hasCustomerPaidCapture } from './refundable-base';

export const VENDOR_CANCELLATION_REASON_SLUGS = ['emergency', 'operational', 'technical'] as const;
export type VendorCancellationReasonSlug = (typeof VENDOR_CANCELLATION_REASON_SLUGS)[number];

export function parseVendorCancellationReason(input: unknown): VendorCancellationReasonSlug | null {
  const s = String(input ?? '')
    .toLowerCase()
    .trim();
  if ((VENDOR_CANCELLATION_REASON_SLUGS as readonly string[]).includes(s)) {
    return s as VendorCancellationReasonSlug;
  }
  return null;
}

export function vendorCancellationReasonLabel(slug: string): string {
  switch (slug) {
    case 'emergency':
      return 'Emergency cancellation';
    case 'operational':
      return 'Operational issue';
    case 'technical':
      return 'Technical failure';
    default:
      return slug;
  }
}

export type ProviderCancelRefundInfo = {
  amount: number;
  percentage: number;
  method: string;
  status: string;
  message: string;
  /** Present after a successful wallet credit (for support / debugging). */
  walletBalanceAfter?: number;
  /** True when refund row already existed (idempotent). */
  alreadyCredited?: boolean;
};

/** PG rows are snake_case; some API layers use camelCase — normalize so refund math and wallet credit always see the same fields. */
function normalizeBookingRowForRefund(row: Record<string, any>): Record<string, any> {
  if (!row || typeof row !== 'object') return row;
  return {
    ...row,
    customer_id: row.customer_id ?? row.customerId,
    vendor_id: row.vendor_id ?? row.vendorId,
    service_id: row.service_id ?? row.serviceId,
    total_amount: row.total_amount ?? row.totalAmount,
    discount_amount: row.discount_amount ?? row.discountAmount ?? null,
    payment_status: row.payment_status ?? row.paymentStatus,
    booking_date: row.booking_date ?? row.bookingDate,
    booking_time: row.booking_time ?? row.bookingTime,
    booking_datetime: row.booking_datetime ?? row.bookingDatetime ?? null,
    scheduled_at: row.scheduled_at ?? row.scheduledAt ?? null,
    service_type: row.service_type ?? row.serviceType,
  };
}

function rowToBookingForPolicy(bookingRow: Record<string, any>): BookingForPolicy {
  return {
    id: String(bookingRow.id),
    vendor_id: bookingRow.vendor_id,
    service_id: bookingRow.service_id,
    service_type: bookingRow.service_type,
    booking_datetime: bookingRow.booking_datetime ?? null,
    scheduled_at: bookingRow.scheduled_at ?? null,
    booking_date: String(bookingRow.booking_date ?? '').split('T')[0],
    booking_time: String(bookingRow.booking_time ?? ''),
    total_amount: bookingRow.total_amount,
    discount_amount: bookingRow.discount_amount ?? null,
  };
}

/**
 * After booking row is marked cancelled_by provider, credit customer per Finance → Refund tiers.
 */
export async function applyRefundAfterProviderCancellation(
  bookingRow: Record<string, any>,
  vendorCancellationReason: VendorCancellationReasonSlug,
  refundReasonSummary: string,
  options?: { refundMethod?: 'wallet' | 'original' }
): Promise<ProviderCancelRefundInfo | null> {
  const refundMethod = options?.refundMethod ?? 'wallet';
  const row = normalizeBookingRowForRefund(bookingRow);
  const bookingId = String(row.id);
  const hasPaid = await hasCustomerPaidCapture(bookingId, {
    total_amount: row.total_amount,
    discount_amount: row.discount_amount,
    payment_status: row.payment_status,
  });
  if (!hasPaid) {
    console.warn('[provider-cancel-refund] skipped — no paid capture for booking', {
      bookingId,
      payment_status: row.payment_status,
      hint: 'Expect bookings.payment_status paid/completed, a completed payments row, or wallet debits for this booking_id',
    });
    return null;
  }

  const bookingForPolicy = rowToBookingForPolicy(row);

  try {
    const preview = await previewProviderCancellationRefund(bookingForPolicy, vendorCancellationReason);
    const refundAmount = Math.round(preview.refundAmount * 100) / 100;
    const refundPercentage = preview.refundPercentage;

    if (refundAmount <= 0) {
      return {
        amount: 0,
        percentage: refundPercentage,
        method: refundMethod,
        status: 'not_eligible',
        message:
          'No refund amount for this cancellation under the configured provider cancellation policy.',
      };
    }

    const payments = await query(
      `SELECT id FROM payments
       WHERE booking_id = $1::uuid
         AND payment_status IN ('completed', 'partially_refunded')
       ORDER BY CASE WHEN payment_status = 'completed' THEN 0 ELSE 1 END
       LIMIT 1`,
      [bookingId]
    ).catch(() => ({ rows: [] as { id: string }[] }));
    const paymentId = (payments as any).rows?.[0]?.id;

    const customerIdForWallet = row.customer_id ? String(row.customer_id) : '';
    if (refundMethod === 'wallet' && customerIdForWallet) {
      try {
        const credit = await creditCustomerWalletForBookingRefund({
          customerId: customerIdForWallet,
          bookingId,
          refundAmount,
          refundPercentage,
          label: 'booking',
        });
        return {
          amount: refundAmount,
          percentage: refundPercentage,
          method: 'wallet',
          status: 'completed',
          message: `₹${refundAmount.toFixed(2)} credited to customer wallet (${refundPercentage}% per policy).`,
          walletBalanceAfter: credit.newBalance,
          alreadyCredited: credit.alreadyCredited === true,
        };
      } catch (e) {
        console.error('[provider-cancel-refund] wallet credit failed:', e);
        return null;
      }
    }

    if (refundMethod === 'wallet' && !customerIdForWallet) {
      console.warn('[provider-cancel-refund] wallet requested but booking has no customer_id — falling back to original-method path if payment exists', {
        bookingId,
      });
    }

    if (paymentId) {
      await query(
        `INSERT INTO refunds (
          payment_id,
          booking_id,
          customer_id,
          vendor_id,
          refund_amount,
          refund_reason,
          refund_status,
          refund_method,
          requested_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', 'original', NOW())`,
        [
          paymentId,
          bookingId,
          row.customer_id,
          row.vendor_id || null,
          refundAmount,
          `${refundReasonSummary} (${refundPercentage}% refund)`,
        ]
      ).catch(() => null);
      return {
        amount: refundAmount,
        percentage: refundPercentage,
        method: 'original',
        status: 'pending',
        message: `Refund of ₹${refundAmount.toFixed(2)} will be processed to original payment method in 3–7 business days.`,
      };
    }

    console.warn('[provider-cancel-refund] No completed payment for original-method refund', bookingId);
    return null;
  } catch (err: any) {
    console.error('[provider-cancel-refund] preview/apply failed:', err?.message);
    return null;
  }
}
