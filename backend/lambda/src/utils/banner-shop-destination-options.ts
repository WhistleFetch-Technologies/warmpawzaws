/**
 * Admin shop banner destination options — storefront-visible products for picker.
 */

import { query } from '../database/rds-connection';

/** Match public storefront listing in ecommerce.ts */
export const STOREFRONT_PRODUCT_SQL = `
  p.is_active = true
  AND LOWER(COALESCE(NULLIF(TRIM(p.status::text), ''), 'pending')) = 'active'
`;

/** Exclude products in admin-disabled ecommerce categories (requires ec join). */
export const STOREFRONT_ACTIVE_CATEGORY_SQL = `
  AND (
    p.category_id IS NULL
    OR ec.is_active = true
  )
`;

export type ShopBannerDestinationProduct = {
  id: string;
  name: string;
  sku: string;
  price: number;
  status: string;
  category: string;
};

export function normalizeShopBannerProductSearch(raw: unknown): string {
  return String(raw ?? '').trim();
}

export function clampShopBannerProductLimit(raw: unknown): number {
  const n = parseInt(String(raw ?? '50'), 10);
  if (!Number.isFinite(n) || n < 1) return 50;
  return Math.min(n, 100);
}

export function mapShopBannerProductRow(row: Record<string, unknown>): ShopBannerDestinationProduct {
  return {
    id: String(row.id ?? ''),
    name: String(row.name ?? '').trim() || 'Product',
    sku: String(row.sku ?? '').trim(),
    price: parseFloat(String(row.price ?? '0')) || 0,
    status: String(row.status ?? 'active'),
    category: String(row.category_name ?? row.category ?? 'Uncategorized').trim() || 'Uncategorized',
  };
}

export async function listShopBannerDestinationProducts(opts?: {
  search?: string;
  limit?: number;
}): Promise<ShopBannerDestinationProduct[]> {
  const search = normalizeShopBannerProductSearch(opts?.search);
  const limit = clampShopBannerProductLimit(opts?.limit);

  const params: unknown[] = [];
  let paramIndex = 1;
  let searchClause = '';

  if (search) {
    searchClause = ` AND (p.name ILIKE $${paramIndex} OR p.sku ILIKE $${paramIndex})`;
    params.push(`%${search}%`);
    paramIndex++;
  }

  params.push(limit);

  const { rows } = await query(
    `SELECT
       p.id::text AS id,
       p.name,
       p.sku,
       p.price,
       p.status,
       ec.name AS category_name
     FROM products p
     LEFT JOIN ecommerce_categories ec ON p.category_id = ec.id
     WHERE ${STOREFRONT_PRODUCT_SQL}${STOREFRONT_ACTIVE_CATEGORY_SQL}
     ${searchClause}
     ORDER BY p.created_at DESC
     LIMIT $${paramIndex}`,
    params
  ).catch(() => ({ rows: [] }));

  return (rows as Record<string, unknown>[]).map(mapShopBannerProductRow).filter((p) => p.id);
}
