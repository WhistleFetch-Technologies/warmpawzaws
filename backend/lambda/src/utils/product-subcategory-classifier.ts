/**
 * Generic multi-match product subcategory classifier driven by ecommerce_category_rules.
 * Evaluates ALL matching rules (never first-match-only).
 */

import { query } from '../database/rds-connection';
import { replaceAutoProductCategoryLinks } from './product-category-links';

export type CategoryRuleRow = {
  subcategory_id: string;
  include_keywords: string[];
  exclude_keywords: string[];
  brand_includes: string[];
};

export type ClassifyProductInput = {
  name?: string | null;
  description?: string | null;
  brand?: string | null;
  parentCategoryId: string;
};

function normalizeKeywords(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((k) => String(k ?? '').trim().toLowerCase())
    .filter((k) => k.length > 0);
}

function textBlob(name?: string | null, description?: string | null, brand?: string | null): string {
  return `${String(name ?? '')} ${String(description ?? '')} ${String(brand ?? '')}`
    .trim()
    .toLowerCase();
}

function containsKeyword(haystack: string, keyword: string): boolean {
  if (!keyword) return false;
  return haystack.includes(keyword);
}

export function ruleMatchesProduct(
  rule: CategoryRuleRow,
  name?: string | null,
  description?: string | null,
  brand?: string | null
): boolean {
  const blob = textBlob(name, description, brand);
  const brandText = String(brand ?? '').trim().toLowerCase();
  if (!blob && !brandText) return false;

  const excludes = normalizeKeywords(rule.exclude_keywords);
  for (const ex of excludes) {
    if (containsKeyword(blob, ex)) return false;
  }

  const includes = normalizeKeywords(rule.include_keywords);
  const brands = normalizeKeywords(rule.brand_includes);

  let includeHit = false;
  for (const inc of includes) {
    if (containsKeyword(blob, inc)) {
      includeHit = true;
      break;
    }
  }

  let brandHit = false;
  if (brands.length > 0 && brandText) {
    for (const b of brands) {
      if (containsKeyword(brandText, b)) {
        brandHit = true;
        break;
      }
    }
  }

  if (includes.length === 0 && brands.length === 0) return false;
  if (includes.length > 0 && brands.length > 0) return includeHit || brandHit;
  if (includes.length > 0) return includeHit;
  return brandHit;
}

export async function loadActiveRulesForParent(
  parentCategoryId: string
): Promise<CategoryRuleRow[]> {
  const parentId = String(parentCategoryId ?? '').trim();
  if (!parentId) return [];

  const res = await query(
    `SELECT r.subcategory_id::text AS subcategory_id,
            COALESCE(r.include_keywords, '{}') AS include_keywords,
            COALESCE(r.exclude_keywords, '{}') AS exclude_keywords,
            COALESCE(r.brand_includes, '{}') AS brand_includes
     FROM ecommerce_category_rules r
     INNER JOIN ecommerce_categories c ON c.id = r.subcategory_id
     WHERE r.is_active = true
       AND c.is_active = true
       AND c.parent_category_id = $1::uuid`,
    [parentId]
  );

  return (res.rows as CategoryRuleRow[]).map((row) => ({
    subcategory_id: String(row.subcategory_id),
    include_keywords: normalizeKeywords(row.include_keywords),
    exclude_keywords: normalizeKeywords(row.exclude_keywords),
    brand_includes: normalizeKeywords(row.brand_includes),
  }));
}

/** Return all matching subcategory ids for a product under a parent category. */
export async function classifyProductSubcategories(
  input: ClassifyProductInput
): Promise<string[]> {
  const parentId = String(input.parentCategoryId ?? '').trim();
  if (!parentId) return [];

  const rules = await loadActiveRulesForParent(parentId);
  const matched: string[] = [];
  for (const rule of rules) {
    if (ruleMatchesProduct(rule, input.name, input.description, input.brand)) {
      matched.push(rule.subcategory_id);
    }
  }
  return matched;
}

export type CanonicalCategory = {
  categoryId: string;
  categoryName: string;
  parentCategoryId: string | null;
  isSubcategory: boolean;
};

/** Resolve catalog category; if child, return parent as canonical business category. */
export async function resolveCanonicalParentCategory(
  categoryId: string
): Promise<CanonicalCategory | null> {
  const id = String(categoryId ?? '').trim();
  if (!id) return null;

  const res = await query(
    `SELECT c.id::text AS id,
            c.name,
            c.parent_category_id::text AS parent_category_id,
            p.name AS parent_name
     FROM ecommerce_categories c
     LEFT JOIN ecommerce_categories p ON p.id = c.parent_category_id
     WHERE c.id = $1::uuid AND (c.is_active = true OR c.is_active IS NULL)
     LIMIT 1`,
    [id]
  );
  const row = res.rows[0] as
    | {
        id: string;
        name: string;
        parent_category_id: string | null;
        parent_name: string | null;
      }
    | undefined;
  if (!row) return null;

  if (row.parent_category_id) {
    return {
      categoryId: row.parent_category_id,
      categoryName: String(row.parent_name ?? '').trim() || 'Category',
      parentCategoryId: row.parent_category_id,
      isSubcategory: true,
    };
  }

  return {
    categoryId: row.id,
    categoryName: row.name,
    parentCategoryId: null,
    isSubcategory: false,
  };
}

/**
 * Coerce category_id to parent, classify, and replace AUTO membership links.
 * Safe no-op when rules table is missing or parent has no children rules.
 */
export async function applyProductSubcategoryClassification(params: {
  productId: string;
  categoryId: string | null | undefined;
  name?: string | null;
  description?: string | null;
  brand?: string | null;
}): Promise<{ categoryId: string | null; categoryName: string | null; linkedSubcategoryIds: string[] }> {
  const productId = String(params.productId ?? '').trim();
  const rawCategoryId = String(params.categoryId ?? '').trim();
  if (!productId || !rawCategoryId) {
    return { categoryId: rawCategoryId || null, categoryName: null, linkedSubcategoryIds: [] };
  }

  try {
    const canonical = await resolveCanonicalParentCategory(rawCategoryId);
    if (!canonical) {
      return { categoryId: rawCategoryId, categoryName: null, linkedSubcategoryIds: [] };
    }

    if (canonical.categoryId !== rawCategoryId) {
      await query(
        `UPDATE products
         SET category_id = $1::uuid,
             category = $2,
             updated_at = NOW()
         WHERE id = $3::uuid`,
        [canonical.categoryId, canonical.categoryName, productId]
      );
    }

    const linked = await classifyProductSubcategories({
      parentCategoryId: canonical.categoryId,
      name: params.name,
      description: params.description,
      brand: params.brand,
    });
    await replaceAutoProductCategoryLinks(productId, linked);

    return {
      categoryId: canonical.categoryId,
      categoryName: canonical.categoryName,
      linkedSubcategoryIds: linked,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // Table may not exist until migration is applied — do not fail product writes.
    if (
      msg.includes('product_category_links') ||
      msg.includes('ecommerce_category_rules') ||
      (err as { code?: string })?.code === '42P01'
    ) {
      console.warn('[subcategory-classifier] tables missing; skip classification', msg);
      return { categoryId: rawCategoryId, categoryName: null, linkedSubcategoryIds: [] };
    }
    throw err;
  }
}

/** Rebuild AUTO links for all products under a parent category. */
export async function rebuildProductCategoryLinksForParent(
  parentCategoryId: string
): Promise<{ processed: number; linked: number }> {
  const parentId = String(parentCategoryId ?? '').trim();
  if (!parentId) return { processed: 0, linked: 0 };

  const productsRes = await query(
    `SELECT id::text AS id, name, description, brand
     FROM products
     WHERE category_id = $1::uuid`,
    [parentId]
  );

  const rules = await loadActiveRulesForParent(parentId);
  let linked = 0;
  const rows = productsRes.rows as {
    id: string;
    name?: string;
    description?: string;
    brand?: string;
  }[];

  for (const p of rows) {
    const matched = rules
      .filter((r) => ruleMatchesProduct(r, p.name, p.description, p.brand))
      .map((r) => r.subcategory_id);
    await replaceAutoProductCategoryLinks(p.id, matched);
    linked += matched.length;
  }

  return { processed: rows.length, linked };
}
