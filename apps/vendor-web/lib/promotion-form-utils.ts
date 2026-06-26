/**
 * Helpers for vendor promotion create/edit forms.
 */

export function parseJsonbArray(field: unknown): string[] {
  if (field == null) return [];
  if (Array.isArray(field)) {
    return field.map((x) => String(x)).filter(Boolean);
  }
  if (typeof field === 'string') {
    const trimmed = field.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((x) => String(x)).filter(Boolean);
      }
    } catch {
      /* ignore */
    }
  }
  return [];
}

export function productScopeLabel(
  selectedIds: string[],
  allProductsCount: number
): string {
  if (selectedIds.length === 0) return 'All products';
  if (allProductsCount > 0 && selectedIds.length >= allProductsCount) {
    return 'All products';
  }
  return `${selectedIds.length} product${selectedIds.length === 1 ? '' : 's'} selected`;
}

export const PRODUCT_SCOPED_PROMOTION_TYPES = [
  'flash_sale',
  'seasonal',
  'buy_x_get_y',
  'first_order',
] as const;

export function usesApplicableProducts(promotionType: string): boolean {
  return (PRODUCT_SCOPED_PROMOTION_TYPES as readonly string[]).includes(promotionType);
}

export function usesBundleProducts(promotionType: string): boolean {
  return promotionType === 'bundle';
}
