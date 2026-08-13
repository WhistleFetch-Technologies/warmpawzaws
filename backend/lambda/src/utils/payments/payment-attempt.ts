/**
 * Payment-attempt helpers. Reuses existing payments.payment_status values:
 * pending | processing = active payable attempt
 * completed = captured
 * failed = terminal unpaid
 * refunded | partially_refunded = captured then refunded
 */

export const ACTIVE_PAYABLE_STATUSES = ['pending', 'processing'] as const;

export function isActivePayablePaymentStatus(status: string | null | undefined): boolean {
  const s = String(status || '').toLowerCase();
  return s === 'pending' || s === 'processing';
}

export function isCapturedPaymentStatus(status: string | null | undefined): boolean {
  const s = String(status || '').toLowerCase();
  return s === 'completed' || s === 'paid';
}

export function isHoldExpiryCancelReason(reason: string | null | undefined): boolean {
  return String(reason || '').trim() === 'payment_window_expired';
}

export type PaymentFinalizationSource = 'verify' | 'webhook' | 'reconciliation' | 'expiry' | 'create-order';

export function logPaymentSafety(event: string, fields: Record<string, unknown>): void {
  console.log(`[PAYMENT-SAFETY] ${event} ${JSON.stringify(fields)}`);
}
