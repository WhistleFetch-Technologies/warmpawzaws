/**
 * Vendor meal plan removal: hard-delete when unused, soft-deactivate when orders/subscriptions exist.
 * Dev often has test meal_orders linked to plans; prod may have none — same code path for both.
 */

import { query } from '../database/rds-connection';

export type MealPlanVendorDeleteResult = {
  success: true;
  mode: 'deleted' | 'deactivated';
  message: string;
  orderCount: number;
  subscriptionCount: number;
};

export async function deleteOrDeactivateMealPlanForVendor(
  planId: string,
  vendorId: string,
): Promise<MealPlanVendorDeleteResult | null> {
  const exists = await query(
    `SELECT id FROM meal_plans WHERE id = $1::uuid AND vendor_id = $2::uuid LIMIT 1`,
    [planId, vendorId],
  );
  if (!exists.rows?.length) return null;

  const countRes = await query(
    `SELECT
       (SELECT COUNT(*)::int FROM meal_orders WHERE meal_plan_id = $1::uuid) AS order_count,
       (SELECT COUNT(*)::int FROM meal_subscriptions WHERE meal_plan_id = $1::uuid) AS subscription_count`,
    [planId],
  );
  const row = countRes.rows?.[0] as { order_count?: number; subscription_count?: number } | undefined;
  const orderCount = Number(row?.order_count) || 0;
  const subscriptionCount = Number(row?.subscription_count) || 0;

  if (orderCount === 0 && subscriptionCount === 0) {
    await query(`DELETE FROM meal_plans WHERE id = $1::uuid AND vendor_id = $2::uuid`, [
      planId,
      vendorId,
    ]);
    return {
      success: true,
      mode: 'deleted',
      message: 'Meal plan deleted',
      orderCount: 0,
      subscriptionCount: 0,
    };
  }

  await query(
    `UPDATE meal_plans SET is_active = false, updated_at = NOW()
     WHERE id = $1::uuid AND vendor_id = $2::uuid`,
    [planId, vendorId],
  );

  const parts: string[] = [];
  if (orderCount > 0) parts.push(`${orderCount} order${orderCount === 1 ? '' : 's'}`);
  if (subscriptionCount > 0) {
    parts.push(`${subscriptionCount} subscription${subscriptionCount === 1 ? '' : 's'}`);
  }
  const detail = parts.length ? ` (${parts.join(', ')} kept for records)` : '';

  return {
    success: true,
    mode: 'deactivated',
    message: `Meal plan removed from your catalog${detail}. It cannot be hard-deleted while linked to past orders.`,
    orderCount,
    subscriptionCount,
  };
}

export function isMealPlanFkViolation(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  const msg = String(e?.message || '');
  return (
    e?.code === '23503' ||
    msg.includes('meal_orders_meal_plan_id_fkey') ||
    (msg.includes('meal_plan') && msg.includes('foreign key'))
  );
}
