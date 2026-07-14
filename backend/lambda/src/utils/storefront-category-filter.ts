/**
 * Storefront product list category filter — parent rollup + Pet Food subcategory text matching.
 */

import { query } from '../database/rds-connection';
import { isValidUUID } from './uuid-validation';
import {
  isPetFoodSubcategoryName,
  petFoodSubcategoryParentProductMatchSql,
} from './pet-food-subcategory-classifier';

export type StorefrontCategoryFilter = {
  clause: string;
  params: unknown[];
  nextParamIndex: number;
};

const PET_FOOD_CATEGORY_NAME = 'Pet Food';

/** In-process cache — Pet Food parent id is stable for the Lambda lifetime. */
let cachedPetFoodParentId: string | null | undefined;

async function resolvePetFoodParentCategoryId(
  explicitParentId: string | null | undefined
): Promise<string | null> {
  if (explicitParentId) return explicitParentId;
  if (cachedPetFoodParentId !== undefined) return cachedPetFoodParentId;

  try {
    const res = await query(
      `SELECT id::text AS id FROM ecommerce_categories
       WHERE name = $1 AND (is_active = true OR is_active IS NULL)
       LIMIT 1`,
      [PET_FOOD_CATEGORY_NAME]
    );
    cachedPetFoodParentId = (res.rows[0] as { id: string } | undefined)?.id ?? null;
  } catch {
    cachedPetFoodParentId = null;
  }
  return cachedPetFoodParentId;
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

  // Pet Food subcategory (Dry/Wet/Puppy/Adult/Treats): include parent-tagged products
  // matched by name/description even when parent_category_id was not persisted in DB.
  if (isPetFoodSubcategoryName(catRow.name)) {
    const parentMatchSql = petFoodSubcategoryParentProductMatchSql(catRow.name);
    const petFoodParentId = await resolvePetFoodParentCategoryId(catRow.parent_category_id);
    if (parentMatchSql && petFoodParentId) {
      return {
        clause: ` AND (
          p.category_id = $${paramIndex}::uuid
          OR (
            p.category_id = $${paramIndex + 1}::uuid
            AND (${parentMatchSql})
          )
        )`,
        params: [raw, petFoodParentId],
        nextParamIndex: paramIndex + 2,
      };
    }
  }

  if (catRow.parent_category_id) {
    return {
      clause: ` AND p.category_id = $${paramIndex}::uuid`,
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
