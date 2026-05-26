/**
 * Load meal_orders rows for a vendor (all linked vendor / identity ids).
 */

import { query } from '../database/rds-connection';

export type VendorMealOrderRow = Record<string, unknown>;

/**
 * Returns the newest meal orders for vendor dashboard (created_at desc).
 * Matches rows on meal_orders.vendor_id, meal_plans.vendor_id, or products.vendor_id.
 */
export async function fetchVendorMealOrdersForVendorIds(
  allVendorIds: string[],
  options?: { status?: string; limit?: number },
): Promise<VendorMealOrderRow[]> {
  if (!allVendorIds.length) return [];

  const limit = Math.min(Math.max(options?.limit ?? 100, 1), 200);
  const params: unknown[] = [allVendorIds];
  let sql = `
    SELECT mo.*
    FROM meal_orders mo
    LEFT JOIN meal_plans mp ON mp.id = mo.meal_plan_id
    WHERE (
      mo.vendor_id::text = ANY($1::text[])
      OR mp.vendor_id::text = ANY($1::text[])
  `;

  // products join is optional — some envs lack category column
  try {
    const probe = await query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'category'
       LIMIT 1`,
    );
    if ((probe.rows?.length ?? 0) > 0) {
      sql += `
      OR EXISTS (
        SELECT 1 FROM products pr
        WHERE pr.id = mo.meal_plan_id
          AND pr.vendor_id::text = ANY($1::text[])
          AND pr.category IN ('meal_plan', 'nutrition', 'food')
      )`;
    }
  } catch {
    /* ignore */
  }

  sql += `
    )
  `;

  if (options?.status) {
    params.push(options.status);
    sql += ` AND mo.status = $${params.length}`;
  }

  params.push(limit);
  sql += ` ORDER BY mo.created_at DESC LIMIT $${params.length}`;

  const result = await query(sql, params);
  return (result.rows || []) as VendorMealOrderRow[];
}
