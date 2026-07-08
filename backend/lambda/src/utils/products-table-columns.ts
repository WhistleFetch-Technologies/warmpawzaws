/**
 * Cached `products` table column introspection — avoids 42703 when optional
 * migrations (e.g. 210_ecommerce_enhancements) are not applied yet.
 */

import { query } from '../database/rds-connection';

const PRODUCTS_COLUMN_CACHE: { until: number; cols: Set<string> | null } = {
  until: 0,
  cols: null,
};
const PRODUCTS_COLUMN_CACHE_TTL_MS = 60_000;

function hasCol(cols: Set<string>, name: string): boolean {
  return cols.has(String(name).toLowerCase());
}

export async function getProductsColumnSet(): Promise<Set<string>> {
  const now = Date.now();
  if (PRODUCTS_COLUMN_CACHE.cols && now < PRODUCTS_COLUMN_CACHE.until) {
    return PRODUCTS_COLUMN_CACHE.cols;
  }
  const r = await query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'products'`,
  );
  const cols = new Set(
    (r.rows || []).map((row: { column_name: string }) => String(row.column_name).toLowerCase()),
  );
  PRODUCTS_COLUMN_CACHE.cols = cols;
  PRODUCTS_COLUMN_CACHE.until = now + PRODUCTS_COLUMN_CACHE_TTL_MS;
  return cols;
}

/** Safe ORDER BY when requested sort columns are unavailable. */
export function resolveStorefrontSafeOrderBy(cols: Set<string>): string {
  if (hasCol(cols, 'created_at')) return 'p.created_at DESC';
  return 'p.id DESC';
}

/**
 * Maps storefront sort param to SQL ORDER BY, with fallbacks when optional columns
 * from migration 210 are missing on RDS.
 */
export function resolveStorefrontProductOrderBy(sortParam: string, cols: Set<string>): string {
  const safe = resolveStorefrontSafeOrderBy(cols);
  const key = String(sortParam || 'popular').trim().toLowerCase();

  switch (key) {
    case 'price_low':
      return hasCol(cols, 'price') ? 'p.price ASC' : safe;
    case 'price_high':
      return hasCol(cols, 'price') ? 'p.price DESC' : safe;
    case 'newest':
      return hasCol(cols, 'created_at') ? 'p.created_at DESC' : 'p.id DESC';
    case 'rating':
      if (hasCol(cols, 'rating')) {
        const tie = hasCol(cols, 'created_at') ? ', p.created_at DESC' : '';
        return `p.rating DESC NULLS LAST${tie}`;
      }
      return safe;
    case 'popular':
    default:
      if (hasCol(cols, 'review_count')) {
        const tie = hasCol(cols, 'created_at') ? ', p.created_at DESC' : '';
        return `p.review_count DESC NULLS LAST${tie}`;
      }
      return safe;
  }
}
