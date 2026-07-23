/**
 * Shared refund status mapping and shop cancel status constants.
 */

export const CUSTOMER_CANCEL_STATUSES = ['pending', 'confirmed'] as const;

export const VENDOR_CANCEL_STATUSES = ['pending', 'confirmed', 'processing'] as const;

/** SQL fragment: active refunds for cumulative cap / sum queries. */
export const ACTIVE_REFUND_STATUS_FILTER = `refund_status NOT IN ('failed', 'rejected')`;

export type DbRefundLifecycleStatus = 'completed' | 'processing' | 'failed';

/** Map Razorpay refund event status to DB CHECK-safe refund_status. */
export function mapRazorpayRefundEventStatus(rzStatus: string): DbRefundLifecycleStatus {
  const s = String(rzStatus || '').toLowerCase();
  if (s === 'processed') return 'completed';
  if (s === 'failed') return 'failed';
  return 'processing';
}
