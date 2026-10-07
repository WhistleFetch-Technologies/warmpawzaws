/**
 * Unpaid checkouts that expired or were abandoned are stored as status = 'cancelled'
 * (e.g. cancellation_reason = 'payment_window_expired'). They were never real bookings,
 * so booking / cancellation metrics must leave them out of both the count and the total.
 */
import { PAYMENT_ABANDON_CANCELLATION_REASONS } from './shop-vendor-visibility';

export const ABANDONED_CHECKOUT_CANCELLATION_REASONS: readonly string[] = [
  ...PAYMENT_ABANDON_CANCELLATION_REASONS,
  'payment abandoned',
].map((r) => r.toLowerCase());

const REASONS_SQL = ABANDONED_CHECKOUT_CANCELLATION_REASONS.map((r) => `'${r}'`).join(', ');

/** SQL predicate: row is an abandoned unpaid checkout. `alias` is the bookings alias (or none). */
export function sqlIsAbandonedCheckout(alias?: string): string {
  const p = alias ? `${alias}.` : '';
  return `(${p}status = 'cancelled' AND LOWER(BTRIM(COALESCE(${p}cancellation_reason, ''))) IN (${REASONS_SQL}))`;
}

/** SQL predicate: row counts toward booking / cancellation metrics. Use in ON for LEFT JOINs. */
export function sqlCountsTowardBookingMetrics(alias?: string): string {
  return `NOT ${sqlIsAbandonedCheckout(alias)}`;
}

export function isAbandonedCheckoutBooking(row: {
  status?: string | null;
  cancellation_reason?: string | null;
}): boolean {
  if (String(row.status ?? '').toLowerCase() !== 'cancelled') return false;
  const reason = String(row.cancellation_reason ?? '').trim().toLowerCase();
  return ABANDONED_CHECKOUT_CANCELLATION_REASONS.includes(reason);
}
