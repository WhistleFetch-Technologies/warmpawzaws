/**
 * Return Window Utilities
 *
 * Priority chain for resolving return_window_days:
 *   1. Vendor-level override (vendors.return_window_days)
 *   2. Platform config (ecommerce_policies.return_window_days)
 *   3. Hard constant DEFAULT_RETURN_WINDOW_DAYS
 */

import { query } from '../database/rds-connection';

export const DEFAULT_RETURN_WINDOW_DAYS = 7;

/**
 * Resolves the effective return window in days for an order.
 * Checks vendor override first, then platform config, then falls back to the constant.
 */
export async function resolveReturnWindowDays(vendorId: string | null | undefined): Promise<number> {
  if (vendorId) {
    try {
      const v = await query(
        'SELECT return_window_days FROM vendors WHERE id = $1 LIMIT 1',
        [vendorId]
      );
      const days = v.rows[0]?.return_window_days;
      if (days != null && Number.isFinite(Number(days))) {
        return Number(days);
      }
    } catch {
      // fall through to platform config
    }
  }

  try {
    const p = await query(
      'SELECT return_window_days FROM ecommerce_policies WHERE return_window_days IS NOT NULL LIMIT 1'
    );
    const days = p.rows[0]?.return_window_days;
    if (days != null && Number.isFinite(Number(days))) {
      return Number(days);
    }
  } catch {
    // fall through to constant
  }

  return DEFAULT_RETURN_WINDOW_DAYS;
}

/**
 * Returns true if the return window has expired.
 * A null/missing delivered_at is treated as expired (cannot return undelivered order).
 */
export function isReturnWindowExpired(
  deliveredAt: string | null | undefined,
  windowDays: number
): boolean {
  if (!deliveredAt) return true;
  const deliveredMs = new Date(deliveredAt).getTime();
  if (Number.isNaN(deliveredMs)) return true;
  const daysSinceDelivery = Math.floor((Date.now() - deliveredMs) / 86_400_000);
  return daysSinceDelivery > windowDays;
}

/**
 * Returns the number of days remaining in the return window.
 * Returns 0 if the window has already closed.
 */
export function returnWindowDaysRemaining(
  deliveredAt: string | null | undefined,
  windowDays: number
): number {
  if (!deliveredAt) return 0;
  const deliveredMs = new Date(deliveredAt).getTime();
  if (Number.isNaN(deliveredMs)) return 0;
  const daysSinceDelivery = Math.floor((Date.now() - deliveredMs) / 86_400_000);
  return Math.max(0, windowDays - daysSinceDelivery);
}
