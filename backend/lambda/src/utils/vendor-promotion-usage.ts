/**
 * Record vendor promotion usage after successful order.
 */
import { insert, query } from '../database/rds-connection';

/** Persist platform `coupons` table redemption on ecommerce order (analytics Coupons tab). */
export async function recordEcommercePlatformCouponUsage(params: {
  couponId: string;
  orderId: string;
  customerId?: string | null;
  discountAmount: number;
}): Promise<void> {
  const { couponId, orderId, customerId, discountAmount } = params;
  try {
    await insert('coupon_usages', {
      coupon_id: couponId,
      customer_id: customerId || null,
      booking_id: null,
      order_id: orderId,
      discount_amount: discountAmount,
      used_at: new Date().toISOString(),
    });
  } catch {
    /* coupon_usages may be missing in some envs */
  }

  await incrementCouponUsageCount(couponId);
}

/** Bump coupon redemption counters — prod schema uses `uses_count`; some envs also have `usage_count`. */
export async function incrementCouponUsageCount(couponId: string): Promise<void> {
  if (!couponId) return;
  const updated = await query(
    `UPDATE coupons
     SET uses_count = COALESCE(uses_count, 0) + 1,
         updated_at = NOW()
     WHERE id = $1::uuid
     RETURNING id`,
    [couponId]
  ).catch(() => ({ rows: [] as { id?: string }[] }));

  if ((updated.rows?.length ?? 0) > 0) return;

  await query(
    `UPDATE coupons
     SET usage_count = COALESCE(usage_count, 0) + 1,
         updated_at = NOW()
     WHERE id = $1::uuid`,
    [couponId]
  ).catch(() => undefined);
}

/** Service booking coupon redemption (Admin Coupons tab usage). */
export async function recordPlatformCouponUsage(params: {
  couponId: string;
  bookingId: string;
  customerId?: string | null;
  discountAmount: number;
}): Promise<void> {
  const { couponId, bookingId, customerId, discountAmount } = params;
  if (!couponId || !bookingId) return;

  const existing = await query(
    `SELECT 1 AS ok FROM coupon_usages
     WHERE coupon_id = $1::uuid AND booking_id = $2::uuid
     LIMIT 1`,
    [couponId, bookingId]
  ).catch(() => ({ rows: [] as { ok?: number }[] }));
  if ((existing.rows?.length ?? 0) > 0) return;

  try {
    await insert('coupon_usages', {
      coupon_id: couponId,
      customer_id: customerId || null,
      booking_id: bookingId,
      order_id: null,
      discount_amount: discountAmount,
      used_at: new Date().toISOString(),
    });
  } catch {
    // Duplicate or missing table — do not bump the counter twice.
    const again = await query(
      `SELECT 1 AS ok FROM coupon_usages
       WHERE coupon_id = $1::uuid AND booking_id = $2::uuid
       LIMIT 1`,
      [couponId, bookingId]
    ).catch(() => ({ rows: [] as { ok?: number }[] }));
    if ((again.rows?.length ?? 0) > 0) return;
    /* coupon_usages may be missing — still try counter bump below */
  }
  await incrementCouponUsageCount(couponId);
}

export async function recordVendorPromotionUsage(params: {
  promotionId: string;
  orderId: string;
  customerId?: string | null;
  discountAmount: number;
  orderSubtotal: number;
}): Promise<void> {
  const { promotionId, orderId, customerId, discountAmount, orderSubtotal } = params;

  await query(
    `UPDATE vendor_promotions
     SET usage_count = COALESCE(usage_count, 0) + 1,
         conversions = COALESCE(conversions, 0) + 1,
         revenue_generated = COALESCE(revenue_generated, 0) + $2,
         updated_at = NOW()
     WHERE id = $1::uuid`,
    [promotionId, orderSubtotal]
  );

  try {
    await insert('promotion_usages', {
      promotion_id: promotionId,
      promotion_type: 'product',
      booking_id: null,
      order_id: orderId,
      customer_id: customerId || null,
      discount_amount: discountAmount,
      original_amount: orderSubtotal,
      final_amount: Math.max(0, orderSubtotal - discountAmount),
      created_at: new Date().toISOString(),
    });
  } catch {
    /* promotion_usages table may be missing in some envs */
  }
}

export async function incrementPromotionView(promotionId: string): Promise<void> {
  await query(
    `UPDATE vendor_promotions
     SET views = COALESCE(views, 0) + 1,
         updated_at = NOW()
     WHERE id = $1::uuid`,
    [promotionId]
  );
}

export async function countPriorVendorOrders(
  customerId: string,
  vendorId: string
): Promise<number> {
  try {
    const res = await query(
      `SELECT COUNT(*)::int AS c FROM orders
       WHERE customer_id = $1::uuid
         AND vendor_id = $2::uuid
         AND COALESCE(order_status, '') NOT IN ('cancelled', 'failed')`,
      [customerId, vendorId]
    );
    return res.rows[0]?.c ?? 0;
  } catch {
    return 0;
  }
}

export async function countPriorVendorBookings(
  customerId: string,
  vendorId: string
): Promise<number> {
  try {
    const res = await query(
      `SELECT COUNT(*)::int AS c FROM bookings
       WHERE customer_id = $1::uuid
         AND vendor_id = $2::uuid
         AND COALESCE(status, '') NOT IN ('cancelled', 'failed', 'rejected')`,
      [customerId, vendorId]
    );
    return res.rows[0]?.c ?? 0;
  } catch {
    return 0;
  }
}

export async function recordServicePromotionUsage(params: {
  promotionId: string;
  bookingId: string;
  customerId?: string | null;
  discountAmount: number;
  originalAmount: number;
}): Promise<void> {
  const { promotionId, bookingId, customerId, discountAmount, originalAmount } = params;

  await query(
    `UPDATE vendor_service_promotions
     SET usage_count = COALESCE(usage_count, 0) + 1,
         conversions = COALESCE(conversions, 0) + 1,
         revenue_generated = COALESCE(revenue_generated, 0) + $2,
         updated_at = NOW()
     WHERE id = $1::uuid`,
    [promotionId, originalAmount]
  );

  try {
    await insert('promotion_usages', {
      promotion_id: promotionId,
      promotion_type: 'service',
      booking_id: bookingId,
      order_id: null,
      customer_id: customerId || null,
      discount_amount: discountAmount,
      original_amount: originalAmount,
      final_amount: Math.max(0, originalAmount - discountAmount),
      created_at: new Date().toISOString(),
    });
  } catch {
    /* promotion_usages table may be missing in some envs */
  }
}

export async function recordPlatformPromotionUsage(params: {
  promotionId: string;
  bookingId: string;
  customerId?: string | null;
  discountAmount: number;
  originalAmount: number;
}): Promise<void> {
  const { promotionId, bookingId, customerId, discountAmount, originalAmount } = params;

  await query(
    `UPDATE promotions
     SET usage_count = COALESCE(usage_count, 0) + 1,
         updated_at = NOW()
     WHERE id = $1::uuid`,
    [promotionId]
  ).catch(() => undefined);

  try {
    await insert('promotion_usages', {
      promotion_id: promotionId,
      promotion_type: 'platform',
      booking_id: bookingId,
      order_id: null,
      customer_id: customerId || null,
      discount_amount: discountAmount,
      original_amount: originalAmount,
      final_amount: Math.max(0, originalAmount - discountAmount),
      created_at: new Date().toISOString(),
    });
  } catch {
    /* promotion_usages table may be missing in some envs */
  }
}
