import type { ShopCategory } from '@/components/shop/shop-types';
import { apiClient } from '@/lib/api-client';
import {
  canonicalizeShopCategorySlug,
  getShopCategoryStaticImageUrl,
  slugifyShopCategoryName,
} from '@/lib/shop-category-static-images';

/** Public storefront categories — only categories with active products when filtered server-side. */
export const SHOP_CATEGORIES_WITH_PRODUCTS_PATH = '/ecommerce/categories?with_products_only=true';

export function isShopCategoryActive(row: Record<string, unknown>): boolean {
  const v = row.is_active ?? row.enabled;
  if (v === undefined) return true;
  return v !== false && v !== 'false';
}

/**
 * Resolve a URL/home category param (UUID, static slug, or short alias) to an API category id.
 * Returns '' when nothing matches.
 */
export function resolveShopCategoryParam(
  param: string | null | undefined,
  categories: ShopCategory[]
): string {
  const raw = String(param ?? '').trim();
  if (!raw || categories.length === 0) return '';

  const byId = categories.find((c) => c.id === raw);
  if (byId) return byId.id;

  const paramSlug = slugifyShopCategoryName(raw);
  const paramCanonical = canonicalizeShopCategorySlug(raw);

  const bySlug = categories.find((c) => {
    const nameSlug = slugifyShopCategoryName(c.name);
    const nameCanonical = canonicalizeShopCategorySlug(c.name);
    return (
      nameSlug === paramSlug ||
      nameCanonical === paramCanonical ||
      nameSlug === paramCanonical ||
      nameCanonical === paramSlug
    );
  });
  if (bySlug) return bySlug.id;

  const lower = raw.toLowerCase();
  const byName = categories.find((c) => c.name.trim().toLowerCase() === lower);
  if (byName) return byName.id;

  return '';
}

export function normalizeShopCategoryRow(row: Record<string, unknown>): ShopCategory {
  const name = String(row.name ?? '').trim();
  const slug = row.slug != null ? String(row.slug).trim() : '';
  const icon = row.icon != null ? String(row.icon) : undefined;
  const staticImage =
    getShopCategoryStaticImageUrl(name) ||
    (slug ? getShopCategoryStaticImageUrl(slug) : undefined);

  const parentRaw = row.parent_category_id;
  const parent_category_id =
    parentRaw != null && String(parentRaw).trim() ? String(parentRaw).trim() : undefined;

  return {
    id: String(row.id ?? ''),
    name,
    icon,
    image_url: staticImage,
    product_count:
      row.product_count != null
        ? parseInt(String(row.product_count), 10) || 0
        : undefined,
    parent_category_id,
  };
}

export function sortShopCategories(categories: ShopCategory[]): ShopCategory[] {
  return [...categories].sort((a, b) => {
    const orderA = a.display_order ?? 0;
    const orderB = b.display_order ?? 0;
    if (orderA !== orderB) return orderA - orderB;
    return a.name.localeCompare(b.name);
  });
}

export function mapApiCategoriesToShop(
  rows: Array<Record<string, unknown>>
): ShopCategory[] {
  const mapped = rows
    .filter((row) => isShopCategoryActive(row))
    .map((row) => {
      const cat = normalizeShopCategoryRow(row);
      if (row.display_order != null) {
        cat.display_order = parseInt(String(row.display_order), 10) || 0;
      }
      return cat;
    })
    .filter((c) => c.id && c.name);

  return sortShopCategories(mapped);
}

/** Keep only categories that have at least one storefront-active product. */
export function filterShopCategoriesWithProducts(categories: ShopCategory[]): ShopCategory[] {
  return categories.filter((c) => (c.product_count ?? 0) > 0);
}

/** Keep only top-level categories, excluding subcategories (e.g. "Dry Pet Food" under "Pet Food"). */
export function filterTopLevelShopCategories(categories: ShopCategory[]): ShopCategory[] {
  return categories.filter((c) => !c.parent_category_id);
}

/** Known Pet Food subcategories seeded in db/migrations/1068 — used when parent_category_id is missing in DB. */
const PET_FOOD_SUBCATEGORY_NAMES = new Set([
  'Dry Pet Food',
  'Wet Pet Food',
  'Puppy Food',
  'Adult Food',
  'Pet Treats',
  'Therapeutic Food',
]);

/** Backfill parent_category_id for seeded Pet Food subcategories when the column was not persisted. */
export function applyKnownPetFoodSubcategoryParents(categories: ShopCategory[]): ShopCategory[] {
  const petFood = categories.find((c) => c.name === 'Pet Food' && !c.parent_category_id);
  if (!petFood) return categories;

  return categories.map((c) => {
    if (c.parent_category_id || !PET_FOOD_SUBCATEGORY_NAMES.has(c.name)) return c;
    return { ...c, parent_category_id: petFood.id };
  });
}

/**
 * Shop page needs subcategory tabs even when a subcategory has zero products tagged directly
 * (products may still live under the parent "Pet Food" id). Merge active subcategories whose
 * parent is in the top-level list returned by with_products_only.
 */
export function mergeShopSubcategoriesForStorefront(
  allCategories: ShopCategory[],
  topLevelWithProducts: ShopCategory[]
): ShopCategory[] {
  const withParents = applyKnownPetFoodSubcategoryParents(allCategories);
  const topLevelIds = new Set(topLevelWithProducts.map((c) => c.id));
  const subcategories = withParents.filter(
    (c) => c.parent_category_id && topLevelIds.has(c.parent_category_id)
  );
  return sortShopCategories([...topLevelWithProducts, ...subcategories]);
}

/**
 * Flat top-level category list for surfaces that render one row/grid of chips or tiles
 * (home "Shop by category" grid, etc). Subcategories are intentionally excluded here —
 * the /shop page fetches categories itself (see loadCategories in app/shop/page.tsx) so it
 * can keep subcategories for its second-level tab row.
 */
export async function fetchShopCategoriesWithProducts(): Promise<ShopCategory[]> {
  const res = await apiClient.get<{ categories?: Array<Record<string, unknown>> }>(
    SHOP_CATEGORIES_WITH_PRODUCTS_PATH
  );
  const raw = res?.categories;
  const mapped = mapApiCategoriesToShop(
    Array.isArray(raw)
      ? raw.map((c) => (c && typeof c === 'object' ? c : {}) as Record<string, unknown>)
      : []
  );
  return filterTopLevelShopCategories(filterShopCategoriesWithProducts(mapped));
}
