/**
 * Shared SQL WHERE fragments for public ecommerce storefront product queries.
 * Uses alias `p` on the products table.
 */

import { storefrontExcludeMealProductsSql } from './ecommerce-storefront-product-filter';

/** Sargable active-status predicate — parity-checked vs legacy LOWER/TRIM expression. */
export const STOREFRONT_ACTIVE_STATUS_SQL = `
  p.is_active = true
  AND LOWER(TRIM(COALESCE(p.status::text, 'pending'))) = 'active'
`;

/** Legacy expression kept for parity tests / migration validation only. */
export const STOREFRONT_LEGACY_ACTIVE_STATUS_SQL = `
  p.is_active = true
  AND LOWER(COALESCE(NULLIF(TRIM(p.status::text), ''), 'pending')) = 'active'
`;

/** Hide products tied to admin-disabled ecommerce categories. */
export const STOREFRONT_ACTIVE_CATEGORY_SQL = `
  AND (
    p.category_id IS NULL
    OR EXISTS (
      SELECT 1 FROM ecommerce_categories ec
      WHERE ec.id = p.category_id AND ec.is_active = true
    )
  )
`;

/**
 * Hide all products for vendors with ecommerce_storefront_hidden = true.
 * Does not rewrite product rows or category membership. Alias `p` required.
 */
export const STOREFRONT_VENDOR_NOT_HIDDEN_SQL = `
  AND NOT EXISTS (
    SELECT 1 FROM vendors vh
    WHERE vh.id = p.vendor_id
      AND COALESCE(vh.ecommerce_storefront_hidden, false) = true
  )
`;

/** Parse admin Hide / Publish body. Prefer `published` when both keys are sent. */
export function parseEcommerceStorefrontVisibilityBody(
  body: unknown
): { hidden: boolean; published: boolean } | null {
  if (body == null || typeof body !== 'object' || Array.isArray(body)) return null;
  const rec = body as Record<string, unknown>;
  if (typeof rec.published === 'boolean') {
    return { published: rec.published, hidden: !rec.published };
  }
  if (typeof rec.hidden === 'boolean') {
    return { hidden: rec.hidden, published: !rec.hidden };
  }
  return null;
}

/** Full storefront visibility WHERE (status + vendor hide + meal exclusion), without category EXISTS. */
export async function storefrontProductWhereSql(): Promise<string> {
  const exclude = await storefrontExcludeMealProductsSql();
  return `
  ${STOREFRONT_ACTIVE_STATUS_SQL}
  ${STOREFRONT_VENDOR_NOT_HIDDEN_SQL}
  ${exclude}`;
}

/** Base WHERE used by list/count handlers: visibility + active category. */
export async function storefrontProductBaseWhereSql(): Promise<string> {
  const productWhere = await storefrontProductWhereSql();
  return `${productWhere}${STOREFRONT_ACTIVE_CATEGORY_SQL}`;
}

/** Partial index predicate — must match indexed rows (status + is_active). */
export const STOREFRONT_INDEX_PARTIAL_WHERE = `is_active = true AND status = 'active'`;
