/**
 * Resolve GST rate for a meal plan from the admin-controlled tax_categories table.
 * Falls back to 5 % (India standard for prepared pet food) when the category row is missing.
 *
 * Meal plans may carry an explicit `tax_category_id`; if not, the platform
 * uses the row named "Meal Plans – Food" seeded in migration 1012.
 */

import { query } from '../database/rds-connection';

const DEFAULT_MEAL_FOOD_GST = 5; // %

let _cache: { foodRate: number; deliveryRate: number; ts: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

async function fetchMealPlanTaxRates(): Promise<{ foodRate: number; deliveryRate: number }> {
  if (_cache && Date.now() - _cache.ts < CACHE_TTL_MS) {
    return { foodRate: _cache.foodRate, deliveryRate: _cache.deliveryRate };
  }

  const res = await query(
    `SELECT name, default_gst_rate FROM tax_categories
     WHERE name IN ('Meal Plans – Food', 'Meal Plans – Delivery Fee')
       AND is_active = TRUE`,
    [],
  ).catch(() => ({ rows: [] }));

  let foodRate = DEFAULT_MEAL_FOOD_GST;
  let deliveryRate = 18;
  for (const row of res.rows as { name: string; default_gst_rate: string | number }[]) {
    const r = parseFloat(String(row.default_gst_rate));
    if (!Number.isFinite(r)) continue;
    if (String(row.name).includes('Delivery')) deliveryRate = r;
    else foodRate = r;
  }

  _cache = { foodRate, deliveryRate, ts: Date.now() };
  return { foodRate, deliveryRate };
}

/**
 * Returns { foodGstPct, deliveryGstPct } for a meal plan.
 * When the plan carries an explicit tax_category_id, the associated rate is used for the food component.
 */
export async function getMealPlanGstRates(plan?: {
  tax_category_id?: string | null;
}): Promise<{ foodGstPct: number; deliveryGstPct: number }> {
  const base = await fetchMealPlanTaxRates();

  if (plan?.tax_category_id) {
    const r = await query(
      `SELECT default_gst_rate FROM tax_categories
       WHERE id = $1 AND is_active = TRUE LIMIT 1`,
      [plan.tax_category_id],
    ).catch(() => ({ rows: [] }));
    const row = r.rows?.[0] as { default_gst_rate: string | number } | undefined;
    if (row) {
      const rate = parseFloat(String(row.default_gst_rate));
      if (Number.isFinite(rate)) return { foodGstPct: rate, deliveryGstPct: base.deliveryRate };
    }
  }

  return { foodGstPct: base.foodRate, deliveryGstPct: base.deliveryRate };
}

/**
 * Compute GST breakdown on a meal subscription checkout total.
 * India: food GST is included in the meal price (vendor sets price inclusive).
 * Returns component amounts for display on the invoice/payment summary.
 */
export function computeMealGstBreakdown(
  foodSubtotal: number,
  deliveryFee: number,
  foodGstPct: number,
  deliveryGstPct: number,
): {
  foodGstAmount: number;
  deliveryGstAmount: number;
  totalGstAmount: number;
  foodGstPct: number;
  deliveryGstPct: number;
} {
  const round = (n: number) => Math.round(n * 100) / 100;
  const foodGst = round((foodSubtotal * foodGstPct) / 100);
  const deliveryGst = round((deliveryFee * deliveryGstPct) / 100);
  return {
    foodGstAmount: foodGst,
    deliveryGstAmount: deliveryGst,
    totalGstAmount: round(foodGst + deliveryGst),
    foodGstPct,
    deliveryGstPct,
  };
}

/** Invalidate cache (useful after admin updates a tax category). */
export function invalidateMealPlanGstCache(): void {
  _cache = null;
}
