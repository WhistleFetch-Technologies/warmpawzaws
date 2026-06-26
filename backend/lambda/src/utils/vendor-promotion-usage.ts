/**
 * Record vendor promotion usage after successful order.
 */
import { insert, query } from '../database/rds-connection';

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
