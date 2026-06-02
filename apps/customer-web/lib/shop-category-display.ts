import type { ShopCategory } from '@/components/shop/shop-types';
import { getShopCategoryStaticImageUrl } from '@/lib/shop-category-static-images';

export function isShopCategoryActive(row: Record<string, unknown>): boolean {
  const v = row.is_active ?? row.enabled;
  if (v === undefined) return true;
  return v !== false && v !== 'false';
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
