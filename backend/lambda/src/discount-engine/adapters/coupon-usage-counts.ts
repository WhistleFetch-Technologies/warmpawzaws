/**
 * Coupon redemption counts for per-customer / global limits.
 * Kept in discount-engine (not platform-coupon-service) to avoid circular imports
 * with the AUTHORITATIVE candidate repository.
 */
import { query } from '../../database/rds-connection';

export async function countCouponUsagesTotal(couponId: string): Promise<number> {
  const res = await query(
    `SELECT COUNT(*)::int AS count FROM coupon_usages WHERE coupon_id = $1::uuid`,
    [couponId]
  ).catch(() => ({ rows: [{ count: 0 }] }));
  return parseInt(String(res.rows?.[0]?.count ?? 0), 10) || 0;
}

/**
 * Count how many times this customer has already claimed the coupon.
 * Includes committed coupon_usages plus in-flight non-cancelled bookings that
 * already applied the code (wallet/Razorpay race protection).
 *
 * Booking-by-code claims are scoped to bookings created at/after this coupon
 * row's created_at so a recreated code (same text, new coupon id) is not
 * blocked by historical redemptions of a deleted/previous coupon.
 */
export async function countCustomerCouponUsages(
  couponId: string,
  customerId: string,
  options?: { couponCode?: string; excludeBookingId?: string }
): Promise<number> {
  const code = options?.couponCode?.trim().toUpperCase() || null;
  const excludeBookingId = options?.excludeBookingId?.trim() || null;

  if (code) {
    const res = await query(
      `SELECT COUNT(*)::int AS count FROM (
         SELECT cu.booking_id::text AS bid
         FROM coupon_usages cu
         WHERE cu.coupon_id = $1::uuid
           AND cu.customer_id = $2::uuid
           AND cu.booking_id IS NOT NULL
           AND ($3::uuid IS NULL OR cu.booking_id <> $3::uuid)
         UNION
         SELECT b.id::text AS bid
         FROM bookings b
         INNER JOIN coupons c ON c.id = $1::uuid
         WHERE b.customer_id = $2::uuid
           AND UPPER(TRIM(COALESCE(b.coupon_code, ''))) = $4
           AND COALESCE(b.discount_amount, 0) > 0
           AND b.created_at >= c.created_at
           AND LOWER(COALESCE(b.status, '')) NOT IN (
             'cancelled', 'canceled', 'expired', 'failed', 'rejected'
           )
           AND ($3::uuid IS NULL OR b.id <> $3::uuid)
       ) claimed`,
      [couponId, customerId, excludeBookingId, code]
    ).catch(() => ({ rows: [{ count: 0 }] }));

    const claimed = parseInt(String(res.rows?.[0]?.count ?? 0), 10) || 0;

    const orphanRes = await query(
      `SELECT COUNT(*)::int AS count FROM coupon_usages
       WHERE coupon_id = $1::uuid AND customer_id = $2::uuid AND booking_id IS NULL`,
      [couponId, customerId]
    ).catch(() => ({ rows: [{ count: 0 }] }));
    const orphans = parseInt(String(orphanRes.rows?.[0]?.count ?? 0), 10) || 0;
    return claimed + orphans;
  }

  const res = await query(
    `SELECT COUNT(*)::int AS count FROM coupon_usages
     WHERE coupon_id = $1::uuid AND customer_id = $2::uuid
       AND ($3::uuid IS NULL OR booking_id IS NULL OR booking_id <> $3::uuid)`,
    [couponId, customerId, excludeBookingId]
  ).catch(() => ({ rows: [{ count: 0 }] }));
  return parseInt(String(res.rows?.[0]?.count ?? 0), 10) || 0;
}
