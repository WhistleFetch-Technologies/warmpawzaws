/**
 * Keep nutrition / meal-plan catalog rows out of the public ecommerce shop.
 * Meal SKUs live in `meal_plans` (canonical) and may mirror into `products` with legacy text categories.
 */

import { query } from '../database/rds-connection';

/** Legacy `products.category` values used by the nutrition meal catalog (not the shop). */
export const MEAL_PRODUCT_LEGACY_CATEGORIES = ['meal_plan', 'nutrition', 'food'] as const;

/** Subset excluded from storefront listings — excludes `food` so pet-food shop SKUs stay visible. */
export const ECOMMERCE_EXCLUDED_MEAL_PRODUCT_CATEGORIES = ['meal_plan', 'nutrition'] as const;

/** Meal subscription purchase types when persisted on `products.purchase_type`. */
export const MEAL_PRODUCT_PURCHASE_TYPES = ['ONE_TIME', 'WEEKLY_PLAN', 'MONTHLY_PLAN'] as const;

/** Subscription purchase types that never belong on the ecommerce storefront. */
export const ECOMMERCE_EXCLUDED_MEAL_PURCHASE_TYPES = ['WEEKLY_PLAN', 'MONTHLY_PLAN'] as const;

/**
 * SQL fragment (includes leading AND) for storefront product queries using alias `p`.
 * Also hides rows whose id exists in `meal_plans` (mirrored nutrition SKUs).
 *
 * `purchase_type` exclusion (WEEKLY_PLAN / MONTHLY_PLAN) requires migration 744 on RDS.
 * When that column is present, use {@link storefrontExcludeMealProductsSql}.
 */
export const STOREFRONT_EXCLUDE_MEAL_PRODUCTS_SQL = `
  AND LOWER(COALESCE(NULLIF(TRIM(p.category::text), ''), '')) NOT IN ('meal_plan', 'nutrition')
  AND NOT EXISTS (SELECT 1 FROM meal_plans mp WHERE mp.id = p.id)
  AND COALESCE(UPPER(NULLIF(TRIM(p.purchase_type::text), '')), '') NOT IN ('WEEKLY_PLAN', 'MONTHLY_PLAN')
`;

export const STOREFRONT_EXCLUDE_MEAL_PRODUCTS_SQL_WITHOUT_PURCHASE_TYPE = `
  AND LOWER(COALESCE(NULLIF(TRIM(p.category::text), ''), '')) NOT IN ('meal_plan', 'nutrition')
  AND NOT EXISTS (SELECT 1 FROM meal_plans mp WHERE mp.id = p.id)
`;

let productsPurchaseTypeColumnKnown: boolean | null = null;

/** Storefront exclusion SQL — omits purchase_type when migration 744 not yet on RDS. */
export async function storefrontExcludeMealProductsSql(): Promise<string> {
  if (productsPurchaseTypeColumnKnown === null) {
    try {
      const r = await query(
        `SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'purchase_type'
         LIMIT 1`,
      );
      productsPurchaseTypeColumnKnown = (r.rows?.length ?? 0) > 0;
    } catch {
      productsPurchaseTypeColumnKnown = false;
    }
  }
  return productsPurchaseTypeColumnKnown
    ? STOREFRONT_EXCLUDE_MEAL_PRODUCTS_SQL
    : STOREFRONT_EXCLUDE_MEAL_PRODUCTS_SQL_WITHOUT_PURCHASE_TYPE;
}

export function normalizeProductCategoryToken(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase();
}

export function isMealProductLegacyCategory(raw: unknown): boolean {
  const c = normalizeProductCategoryToken(raw);
  return (MEAL_PRODUCT_LEGACY_CATEGORIES as readonly string[]).includes(c);
}

export function isEcommerceExcludedMealProductCategory(raw: unknown): boolean {
  const c = normalizeProductCategoryToken(raw);
  return (ECOMMERCE_EXCLUDED_MEAL_PRODUCT_CATEGORIES as readonly string[]).includes(c);
}

export function isMealProductPurchaseType(raw: unknown): boolean {
  const pt = String(raw ?? '')
    .trim()
    .toUpperCase();
  return pt !== '' && (MEAL_PRODUCT_PURCHASE_TYPES as readonly string[]).includes(pt);
}

export function isEcommerceExcludedMealPurchaseType(raw: unknown): boolean {
  const pt = String(raw ?? '')
    .trim()
    .toUpperCase();
  return pt !== '' && (ECOMMERCE_EXCLUDED_MEAL_PURCHASE_TYPES as readonly string[]).includes(pt);
}

/** True when a product row should not appear on the ecommerce storefront. */
export function isProductRowExcludedFromEcommerceStorefront(row: Record<string, unknown>): boolean {
  if (isEcommerceExcludedMealProductCategory(row.category)) return true;
  if (isEcommerceExcludedMealPurchaseType(row.purchase_type ?? row.purchaseType)) return true;
  if (row.is_meal_plan === true || row.isMealPlan === true) return true;
  return false;
}

/** Returns true when the product id must not be sold via the ecommerce shop/cart. */
export async function productIdIsExcludedFromEcommerceStorefront(productId: string): Promise<boolean> {
  const id = String(productId || '').trim();
  if (!id) return true;

  const mp = await query(`SELECT 1 FROM meal_plans WHERE id = $1::uuid LIMIT 1`, [id]).catch(() => ({
    rows: [],
  }));
  if (mp.rows?.length) return true;

  const pr = await query(`SELECT category FROM products WHERE id = $1::uuid LIMIT 1`, [id]).catch(
    () => ({ rows: [] }),
  );

  const row = pr.rows?.[0] as Record<string, unknown> | undefined;
  if (!row) return false;
  return isProductRowExcludedFromEcommerceStorefront(row);
}
