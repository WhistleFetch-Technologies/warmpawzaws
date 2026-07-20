/**
 * Resolve a customer meal checkout ID from `meal_plans` only.
 * Nutrition catalog is not stored in or mirrored from `products`.
 */

import { query } from '../database/rds-connection';
import { isValidUUID } from '../types/entities';

/**
 * Returns a DB-shaped meal plan row for GET /meal-plans/:id and order-preview,
 * or null if `meal_plans` has no matching row.
 */
export async function resolveMealPlanById(planId: string): Promise<Record<string, unknown> | null> {
  const id = String(planId || '').trim();
  if (!id || !isValidUUID(id)) return null;

  try {
    const mpRes = await query(`SELECT * FROM meal_plans WHERE id = $1 LIMIT 1`, [id]);
    if (mpRes.rows?.length) {
      return mpRes.rows[0] as Record<string, unknown>;
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[meal-plan-resolve] meal_plans lookup failed:', msg);
  }
  return null;
}

/** @deprecated Use {@link resolveMealPlanById}. Kept for call-site compatibility during rename. */
export const resolveMealPlanOrProductById = resolveMealPlanById;

/** Human-readable catalog title from `meal_plans`. */
export async function resolveMealCatalogDisplayName(planId: string): Promise<string | null> {
  const row = await resolveMealPlanById(planId);
  if (!row) return null;
  const name = String(row.plan_name ?? row.name ?? '').trim();
  return name || null;
}
