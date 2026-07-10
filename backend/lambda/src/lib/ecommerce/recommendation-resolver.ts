/**
 * Unified ecommerce product recommendations (cart + PDP).
 * All storefront responses use prepareStorefrontProductRow for presigned images.
 */

import { query, select } from '../../database/rds-connection';
import {
  normalizeProductImagesField,
  prepareStorefrontProductRow,
} from '../../utils/s3-media-presign';
import { STOREFRONT_EXCLUDE_MEAL_PRODUCTS_SQL } from '../../utils/ecommerce-storefront-product-filter';

export const ECOMMERCE_RECOMMENDATIONS_DEFAULT_LIMIT = 15;
export const ECOMMERCE_RECOMMENDATIONS_MAX_LIMIT = 15;

const PRODUCT_SELECT_FIELDS = `
  p.id,
  p.name,
  p.description,
  p.price,
  p.compare_at_price,
  p.images,
  p.metadata,
  p.rating,
  p.review_count,
  p.category,
  p.category_id,
  p.vendor_id,
  p.stock,
  v.business_name as vendor_name
`;

export type CartRecommendationItem = {
  productId?: string;
  categoryId?: string;
  quantity?: number;
  price?: number;
};

export type EcommerceRecommendationInput =
  | { context: 'cart'; items: CartRecommendationItem[]; limit?: number }
  | { context: 'product'; productId: string; limit?: number };

export function clampRecommendationLimit(raw: unknown): number {
  const n = parseInt(String(raw ?? ECOMMERCE_RECOMMENDATIONS_DEFAULT_LIMIT), 10);
  if (!Number.isFinite(n) || n < 1) return ECOMMERCE_RECOMMENDATIONS_DEFAULT_LIMIT;
  return Math.min(n, ECOMMERCE_RECOMMENDATIONS_MAX_LIMIT);
}

export function preparedImagesToUrls(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return normalizeProductImagesField(raw);
  }
  return raw
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const o = item as Record<string, unknown>;
        for (const k of ['url', 'src', 'image_url'] as const) {
          if (typeof o[k] === 'string' && (o[k] as string).trim()) {
            return (o[k] as string).trim();
          }
        }
      }
      return '';
    })
    .filter(Boolean);
}

export async function formatRecommendationProduct(
  row: Record<string, unknown>,
  extras?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const prepared = await prepareStorefrontProductRow(row);
  const images = preparedImagesToUrls(prepared.images);
  const compareAt = prepared.compare_at_price;

  return {
    id: prepared.id,
    name: prepared.name,
    description: prepared.description,
    price: parseFloat(String(prepared.price ?? 0)),
    compareAtPrice:
      compareAt != null && compareAt !== '' ? parseFloat(String(compareAt)) : null,
    compare_at_price: compareAt,
    images,
    rating: parseFloat(String(prepared.rating ?? 0)) || 0,
    reviewCount: parseInt(String(prepared.review_count ?? 0), 10) || 0,
    review_count: prepared.review_count,
    category: prepared.category,
    categoryId: prepared.category_id,
    category_id: prepared.category_id,
    vendorName: prepared.vendor_name,
    vendor_name: prepared.vendor_name,
    vendor_id: prepared.vendor_id,
    stock: prepared.stock ?? prepared.stock_quantity,
    stock_quantity: prepared.stock_quantity,
    ...extras,
  };
}

export async function formatRecommendationProducts(
  rows: Record<string, unknown>[],
  extrasFn?: (row: Record<string, unknown>) => Record<string, unknown>,
): Promise<Record<string, unknown>[]> {
  return Promise.all(
    rows.map((row) => formatRecommendationProduct(row, extrasFn?.(row))),
  );
}

async function fetchAlsoBoughtRows(
  productId: string,
  limit: number,
): Promise<Record<string, unknown>[]> {
  const alsoBoughtQuery = `
    WITH product_orders AS (
      SELECT DISTINCT oi.order_id
      FROM order_items oi
      WHERE oi.product_id = $1
    ),
    co_purchased AS (
      SELECT
        oi.product_id,
        COUNT(DISTINCT oi.order_id) as purchase_count
      FROM order_items oi
      JOIN product_orders po ON oi.order_id = po.order_id
      WHERE oi.product_id != $1
      GROUP BY oi.product_id
      HAVING COUNT(DISTINCT oi.order_id) >= 2
      ORDER BY purchase_count DESC
      LIMIT $2
    )
    SELECT
      ${PRODUCT_SELECT_FIELDS},
      cp.purchase_count
    FROM co_purchased cp
    JOIN products p ON cp.product_id = p.id
    LEFT JOIN vendors v ON p.vendor_id = v.id
    WHERE p.is_active = true AND p.stock > 0
      ${STOREFRONT_EXCLUDE_MEAL_PRODUCTS_SQL}
    ORDER BY cp.purchase_count DESC
  `;

  const results = await query(alsoBoughtQuery, [productId, limit]);
  let products = (results.rows || []) as Record<string, unknown>[];

  if (products.length < limit) {
    const currentProduct = await select('products', { id: productId });
    if (currentProduct.length > 0) {
      const category = currentProduct[0].category;
      const existingIds = products.map((p) => p.id);
      existingIds.push(productId);

      const supplementQuery = `
        SELECT
          ${PRODUCT_SELECT_FIELDS},
          0 as purchase_count
        FROM products p
        LEFT JOIN vendors v ON p.vendor_id = v.id
        WHERE p.is_active = true
          AND p.stock > 0
          ${STOREFRONT_EXCLUDE_MEAL_PRODUCTS_SQL}
          AND p.category = $1
          AND p.id NOT IN (${existingIds.map((_, i) => `$${i + 2}`).join(',')})
        ORDER BY p.sales_count DESC, p.rating DESC
        LIMIT $${existingIds.length + 2}
      `;

      const supplement = await query(supplementQuery, [
        category,
        ...existingIds,
        limit - products.length,
      ]);
      products = [...products, ...((supplement.rows || []) as Record<string, unknown>[])];
    }
  }

  return products.slice(0, limit);
}

async function fetchSimilarProductRows(
  productId: string,
  limit: number,
  excludeIds: Set<string>,
): Promise<Record<string, unknown>[]> {
  if (limit <= 0) return [];

  const current = await query(
    `SELECT id, category, vendor_id FROM products WHERE id = $1::uuid LIMIT 1`,
    [productId],
  );
  if (!current.rows.length) return [];

  const row = current.rows[0] as { category?: string; vendor_id?: string };
  const exclude = [...excludeIds, productId];
  const params: unknown[] = [];
  let paramIdx = 1;

  let sql = `
    SELECT
      ${PRODUCT_SELECT_FIELDS}
    FROM products p
    LEFT JOIN vendors v ON p.vendor_id = v.id
    WHERE p.is_active = true
      AND COALESCE(p.stock, 0) > 0
      ${STOREFRONT_EXCLUDE_MEAL_PRODUCTS_SQL}
      AND p.id <> $${paramIdx++}::uuid
  `;
  params.push(productId);

  if (exclude.length > 1) {
    const others = exclude.filter((id) => id !== productId);
    sql += ` AND p.id NOT IN (${others.map(() => `$${paramIdx++}::uuid`).join(',')})`;
    params.push(...others);
  }

  if (row.category) {
    sql += ` AND p.category = $${paramIdx++}`;
    params.push(row.category);
  }

  if (row.vendor_id) {
    sql += ` ORDER BY CASE WHEN p.vendor_id = $${paramIdx++}::uuid THEN 0 ELSE 1 END, p.sales_count DESC NULLS LAST`;
    params.push(row.vendor_id);
  } else {
    sql += ` ORDER BY p.sales_count DESC NULLS LAST, p.created_at DESC`;
  }

  sql += ` LIMIT $${paramIdx}`;
  params.push(limit);

  const result = await query(sql, params);
  return (result.rows || []) as Record<string, unknown>[];
}

export async function resolveCartRecommendations(input: {
  items: CartRecommendationItem[];
  limit?: number;
}): Promise<Record<string, unknown>[]> {
  const limit = clampRecommendationLimit(input.limit);
  const items = Array.isArray(input.items) ? input.items : [];

  const excludeIds = new Set(
    items.map((i) => String(i.productId || '')).filter(Boolean),
  );

  const categorySpend = new Map<string, number>();
  for (const item of items) {
    const cat = item.categoryId ? String(item.categoryId) : '';
    if (!cat) continue;
    const spend = (Number(item.price) || 0) * (Number(item.quantity) || 1);
    categorySpend.set(cat, (categorySpend.get(cat) || 0) + spend);
  }

  const sortedCategories = [...categorySpend.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([cat]) => cat);

  if (sortedCategories.length === 0) {
    return [];
  }

  const results: Record<string, unknown>[] = [];

  const pickFromCategory = async (categoryId: string) => {
    const exclude = [...excludeIds];
    const params: unknown[] = [categoryId];
    let excludeClause = '';
    if (exclude.length > 0) {
      excludeClause = ` AND p.id NOT IN (${exclude.map((_, i) => `$${i + 2}`).join(',')})`;
      params.push(...exclude);
    }
    params.push(1);
    const limitParam = `$${params.length}`;
    const sql = `
      SELECT
        ${PRODUCT_SELECT_FIELDS}
      FROM products p
      LEFT JOIN vendors v ON p.vendor_id = v.id
      WHERE p.is_active = true
        AND p.stock > 0
        ${STOREFRONT_EXCLUDE_MEAL_PRODUCTS_SQL}
        AND (p.category_id::text = $1 OR p.category = $1)
        ${excludeClause}
      ORDER BY COALESCE(p.sales_count, 0) DESC, COALESCE(p.rating, 0) DESC NULLS LAST
      LIMIT ${limitParam}
    `;
    const res = await query(sql, params);
    return (res.rows?.[0] as Record<string, unknown>) || null;
  };

  for (const cat of sortedCategories) {
    if (results.length >= limit) break;
    const row = await pickFromCategory(cat);
    if (row?.id) {
      results.push(row);
      excludeIds.add(String(row.id));
    }
  }

  for (const cat of sortedCategories) {
    while (results.length < limit) {
      const row = await pickFromCategory(cat);
      if (!row?.id) break;
      results.push(row);
      excludeIds.add(String(row.id));
    }
    if (results.length >= limit) break;
  }

  return formatRecommendationProducts(results);
}

export async function resolveProductRecommendations(input: {
  productId: string;
  limit?: number;
}): Promise<Record<string, unknown>[]> {
  const limit = clampRecommendationLimit(input.limit);
  const productId = String(input.productId || '').trim();
  if (!productId) return [];

  const alsoBoughtRows = await fetchAlsoBoughtRows(productId, limit);
  const seen = new Set<string>([productId]);
  const merged: Record<string, unknown>[] = [];

  for (const row of alsoBoughtRows) {
    const id = String(row.id ?? '');
    if (!id || seen.has(id)) continue;
    seen.add(id);
    merged.push(row);
    if (merged.length >= limit) break;
  }

  if (merged.length < limit) {
    const similarRows = await fetchSimilarProductRows(
      productId,
      limit - merged.length,
      seen,
    );
    for (const row of similarRows) {
      const id = String(row.id ?? '');
      if (!id || seen.has(id)) continue;
      seen.add(id);
      merged.push(row);
      if (merged.length >= limit) break;
    }
  }

  return formatRecommendationProducts(merged, (p) => ({
    purchaseCount: parseInt(String(p.purchase_count ?? 0), 10) || 0,
  }));
}

export async function resolveEcommerceRecommendations(
  input: EcommerceRecommendationInput,
): Promise<Record<string, unknown>[]> {
  if (input.context === 'cart') {
    return resolveCartRecommendations({ items: input.items, limit: input.limit });
  }
  return resolveProductRecommendations({
    productId: input.productId,
    limit: input.limit,
  });
}
