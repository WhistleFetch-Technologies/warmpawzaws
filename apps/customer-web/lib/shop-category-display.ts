import type { ShopCategory } from '@/components/shop/shop-types';

export function isShopCategoryActive(row: Record<string, unknown>): boolean {
  const v = row.is_active ?? row.enabled;
  if (v === undefined) return true;
  return v !== false && v !== 'false';
}

export function normalizeShopCategoryRow(row: Record<string, unknown>): ShopCategory {
  const rawImage = row.image_url ?? row.imageUrl;
  const icon = row.icon != null ? String(row.icon) : undefined;

  return {
    id: String(row.id ?? ''),
    name: String(row.name ?? '').trim(),
    icon,
    image_url: rawImage != null && String(rawImage).trim() ? String(rawImage).trim() : undefined,
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
