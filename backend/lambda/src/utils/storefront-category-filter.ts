/**
 * Storefront product list category filter — parent canonical category + subcategory membership links.
 */

import { query } from '../database/rds-connection';
import { isValidUUID } from './uuid-validation';

export type StorefrontCategoryFilter = {
  clause: string;
  params: unknown[];
  nextParamIndex: number;
};

let linksTableAvailable: boolean | undefined;

async function hasProductCategoryLinksTable(): Promise<boolean> {
  if (linksTableAvailable !== undefined) return linksTableAvailable;
  try {
    await query(`SELECT 1 FROM product_category_links LIMIT 0`);
    linksTableAvailable = true;
  } catch {
    linksTableAvailable = false;
  }
  return linksTableAvailable;
}

export async function buildStorefrontCategoryFilter(
  category: string,
  paramIndex: number
): Promise<StorefrontCategoryFilter | null> {
  const raw = String(category ?? '').trim();
  if (!raw) return null;

  if (!isValidUUID(raw)) {
    return {
      clause: ` AND LOWER(TRIM(COALESCE(p.category, ''))) = LOWER(TRIM($${paramIndex}))`,
      params: [raw],
      nextParamIndex: paramIndex + 1,
    };
  }

  let catRow: { id: string; name: string; parent_category_id: string | null } | undefined;
  try {
    const catResult = await query(
      `SELECT id::text AS id, name,
              parent_category_id::text AS parent_category_id
       FROM ecommerce_categories
       WHERE id = $1::uuid AND is_active = true
       LIMIT 1`,
      [raw]
    );
    catRow = catResult.rows[0] as typeof catRow;
  } catch (err: unknown) {
    const dbErr = err as { message?: string; code?: string };
    if (dbErr.message?.includes('parent_category_id') || dbErr.code === '42703') {
      const catResult = await query(
        `SELECT id::text AS id, name
         FROM ecommerce_categories
         WHERE id = $1::uuid AND is_active = true
         LIMIT 1`,
        [raw]
      );
      const row = catResult.rows[0] as { id: string; name: string } | undefined;
      catRow = row ? { ...row, parent_category_id: null } : undefined;
    } else {
      throw err;
    }
  }

  if (!catRow) {
    return {
      clause: ` AND p.category_id = $${paramIndex}::uuid`,
      params: [raw],
      nextParamIndex: paramIndex + 1,
    };
  }

  const useLinks = await hasProductCategoryLinksTable();

  // Subcategory: membership links (preferred) with legacy category_id fallback.
  if (catRow.parent_category_id) {
    if (useLinks) {
      return {
        clause: ` AND (
          p.category_id = $${paramIndex}::uuid
          OR EXISTS (
            SELECT 1 FROM product_category_links pcl
            WHERE pcl.product_id = p.id AND pcl.subcategory_id = $${paramIndex}::uuid
          )
        )`,
        params: [raw],
        nextParamIndex: paramIndex + 1,
      };
    }
    return {
      clause: ` AND p.category_id = $${paramIndex}::uuid`,
      params: [raw],
      nextParamIndex: paramIndex + 1,
    };
  }

  // Parent: canonical category_id (products normalized to parent) + legacy children IN + links under children.
  if (useLinks) {
    return {
      clause: ` AND (
        p.category_id = $${paramIndex}::uuid
        OR p.category_id IN (
          SELECT id FROM ecommerce_categories WHERE parent_category_id = $${paramIndex}::uuid
        )
        OR EXISTS (
          SELECT 1 FROM product_category_links pcl
          INNER JOIN ecommerce_categories child ON child.id = pcl.subcategory_id
          WHERE pcl.product_id = p.id AND child.parent_category_id = $${paramIndex}::uuid
        )
      )`,
      params: [raw],
      nextParamIndex: paramIndex + 1,
    };
  }

  return {
    clause: ` AND (p.category_id = $${paramIndex}::uuid OR p.category_id IN (
      SELECT id FROM ecommerce_categories WHERE parent_category_id = $${paramIndex}::uuid
    ))`,
    params: [raw],
    nextParamIndex: paramIndex + 1,
  };
}
