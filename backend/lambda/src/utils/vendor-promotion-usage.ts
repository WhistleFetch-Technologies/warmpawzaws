/**
 * Record vendor promotion usage after successful order.
 */
import { insert, query } from '../database/rds-connection';

async function couponUsagesColumnSet(): Promise<Set<string>> {
  const r = await query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'coupon_usages'`
  ).catch(() => ({ rows: [] as { column_name: string }[] }));
  return new Set((r.rows || []).map((x: { column_name: string }) => x.column_name));
}

/**
 * Insert a coupon_usages row using only columns that exist on this RDS schema.
 * Prod historically has no discount_amount — Analytics reads these event rows.
 */
export async function insertCouponUsageRow(params: {
  couponId: string;
  customerId?: string | null;
  bookingId?: string | null;
  orderId?: string | null;
  discountAmount?: number;
}): Promise<boolean> {
  const cols = await couponUsagesColumnSet();
  if (!cols.has('coupon_id')) return false;

  const row: Record<string, unknown> = { coupon_id: params.couponId };
  if (cols.has('customer_id')) row.customer_id = params.customerId || null;
  if (cols.has('booking_id')) row.booking_id = params.bookingId || null;
  if (cols.has('order_id')) row.order_id = params.orderId || null;
  if (cols.has('discount_amount') && params.discountAmount != null) {
    row.discount_amount = params.discountAmount;
  }
  if (cols.has('used_at')) row.used_at = new Date().toISOString();

  try {
    await insert('coupon_usages', row);
    return true;
  } catch {
    return false;
  }
}

/** Persist platform `coupons` table redemption on ecommerce order (analytics Coupons tab). */
export async function recordEcommercePlatformCouponUsage(params: {
  couponId: string;
  orderId: string;
  customerId?: string | null;
  discountAmount: number;
}): Promise<void> {
  const { couponId, orderId, customerId, discountAmount } = params;
  await insertCouponUsageRow({
    couponId,
    customerId,
    orderId,
    bookingId: null,
    discountAmount,
  });
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

/** Service booking coupon redemption (Admin Coupons tab + V2 Analytics). */
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

  const inserted = await insertCouponUsageRow({
    couponId,
    customerId,
    bookingId,
    orderId: null,
    discountAmount,
  });
  if (!inserted) {
    const again = await query(
      `SELECT 1 AS ok FROM coupon_usages
       WHERE coupon_id = $1::uuid AND booking_id = $2::uuid
       LIMIT 1`,
      [couponId, bookingId]
    ).catch(() => ({ rows: [] as { ok?: number }[] }));
    if ((again.rows?.length ?? 0) > 0) return;
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

/** True when a promotion_usages row already exists for this promotion+booking (idempotency). */
async function promotionUsageExistsForBooking(
  promotionId: string,
  bookingId: string
): Promise<boolean> {
  const existing = await query(
    `SELECT 1 AS ok FROM promotion_usages
     WHERE promotion_id = $1::uuid AND booking_id = $2::uuid
     LIMIT 1`,
    [promotionId, bookingId]
  ).catch(() => ({ rows: [] as { ok?: number }[] }));
  return (existing.rows?.length ?? 0) > 0;
}

export async function recordServicePromotionUsage(params: {
  promotionId: string;
  bookingId: string;
  customerId?: string | null;
  discountAmount: number;
  originalAmount: number;
}): Promise<void> {
  const { promotionId, bookingId, customerId, discountAmount, originalAmount } = params;
  if (await promotionUsageExistsForBooking(promotionId, bookingId)) return;

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
  if (await promotionUsageExistsForBooking(promotionId, bookingId)) return;

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
