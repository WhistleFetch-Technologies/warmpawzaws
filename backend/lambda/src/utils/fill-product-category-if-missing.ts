/**
 * Fill promo cart-line category only when the client omitted it.
 * Never overwrite a category the client already sent (slug campaigns stay intact).
 */

import { query } from '../database/rds-connection';

export function stripProductSkuSuffix(productId: string): string {
  const raw = String(productId || '');
  const sep = raw.indexOf('::');
  return sep > 0 ? raw.slice(0, sep) : raw;
}

/** Client category wins when present; resolved/DB category fills only if missing. */
export function resolveOrderPromoLineCategory(
  fromClient: unknown,
  resolvedCategoryId: string | null | undefined
): string | undefined {
  const client = fromClient != null && String(fromClient).trim() !== ''
    ? String(fromClient).trim()
    : '';
  if (client) return client;
  const resolved =
    resolvedCategoryId != null && String(resolvedCategoryId).trim() !== ''
      ? String(resolvedCategoryId).trim()
      : '';
  return resolved || undefined;
}

function lineHasCategory(line: { categoryId?: string; category?: string }): boolean {
  return Boolean(String(line.categoryId || line.category || '').trim());
}

async function loadCategoryIdByProductIds(
  productIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = Array.from(
    new Set(productIds.map(stripProductSkuSuffix).filter(Boolean))
  );
  if (unique.length === 0) return map;
  try {
    const result = await query(
      `SELECT id::text AS id, category_id::text AS category_id
         FROM products
        WHERE id = ANY($1::uuid[])`,
      [unique]
    );
    for (const row of result.rows || []) {
      const id = row.id != null ? String(row.id) : '';
      const categoryId =
        row.category_id != null && String(row.category_id).trim() !== ''
          ? String(row.category_id).trim()
          : '';
      if (id && categoryId) map.set(id, categoryId);
    }
  } catch {
    /* products.category_id lookup may fail if ids are not UUIDs */
  }
  return map;
}

/** Fill categoryId/category only when both are empty. Does not overwrite. */
export async function fillProductCategoryIfMissing<
  T extends { productId: string; categoryId?: string; category?: string },
>(lines: T[]): Promise<T[]> {
  if (lines.length === 0) return lines;
  if (lines.every(lineHasCategory)) return lines;
  const categoryMap = await loadCategoryIdByProductIds(lines.map((l) => l.productId));
  return lines.map((line) => {
    if (lineHasCategory(line)) return line;
    const fromDb = categoryMap.get(stripProductSkuSuffix(line.productId));
    if (!fromDb) return line;
    return { ...line, categoryId: fromDb, category: fromDb };
  });
}
