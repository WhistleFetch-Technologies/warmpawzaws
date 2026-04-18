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
};

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
  const bookingId = String(bookingRow.id);
  const hasPaid = await hasCustomerPaidCapture(bookingId, {
    total_amount: bookingRow.total_amount,
    discount_amount: bookingRow.discount_amount,
    payment_status: bookingRow.payment_status,
  });
  if (!hasPaid) {
    return null;
  }

  const bookingForPolicy = rowToBookingForPolicy(bookingRow);

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

    if (refundMethod === 'wallet' && bookingRow.customer_id) {
      try {
        await creditCustomerWalletForBookingRefund({
          customerId: String(bookingRow.customer_id),
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
        };
      } catch (e) {
        console.error('[provider-cancel-refund] wallet credit failed:', e);
        return null;
      }
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
          bookingRow.customer_id,
          bookingRow.vendor_id || null,
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
