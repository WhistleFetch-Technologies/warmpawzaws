/**
 * Product ↔ subcategory membership helpers (AUTO / ADMIN sources).
 */

import { query } from '../database/rds-connection';

export type ProductCategoryLinkSource = 'AUTO' | 'ADMIN';

export async function replaceAutoProductCategoryLinks(
  productId: string,
  subcategoryIds: string[]
): Promise<void> {
  const id = String(productId ?? '').trim();
  if (!id) return;

  const unique = [...new Set(subcategoryIds.map((s) => String(s).trim()).filter(Boolean))];

  await query(
    `DELETE FROM product_category_links
     WHERE product_id = $1::uuid AND source = 'AUTO'`,
    [id]
  );

  if (unique.length === 0) return;

  for (const subcategoryId of unique) {
    await query(
      `INSERT INTO product_category_links (product_id, subcategory_id, source, created_at, updated_at)
       VALUES ($1::uuid, $2::uuid, 'AUTO', NOW(), NOW())
       ON CONFLICT (product_id, subcategory_id) DO UPDATE SET
         updated_at = NOW()
       WHERE product_category_links.source = 'AUTO'`,
      [id, subcategoryId]
    );
  }
}

/**
 * After deleting AUTO rows, re-insert only missing AUTO links without touching ADMIN rows.
 * Prefer {@link replaceAutoProductCategoryLinks} for normal classify-on-write.
 */
export async function upsertAutoProductCategoryLinks(
  productId: string,
  subcategoryIds: string[]
): Promise<void> {
  await replaceAutoProductCategoryLinks(productId, subcategoryIds);
}

export async function listLinkedSubcategoryIds(productId: string): Promise<string[]> {
  const res = await query(
    `SELECT subcategory_id::text AS subcategory_id
     FROM product_category_links
     WHERE product_id = $1::uuid`,
    [productId]
  );
  return (res.rows as { subcategory_id: string }[]).map((r) => r.subcategory_id);
}
