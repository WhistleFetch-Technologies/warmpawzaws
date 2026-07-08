import type { ShopCategory } from '@/components/shop/shop-types';
import {
  canonicalizeShopCategorySlug,
  getShopCategoryStaticImageUrl,
  slugifyShopCategoryName,
} from '@/lib/shop-category-static-images';

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

  return {
    id: String(row.id ?? ''),
    name,
    icon,
    image_url: staticImage,
    product_count:
      row.product_count != null
        ? parseInt(String(row.product_count), 10) || 0
        : undefined,
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
