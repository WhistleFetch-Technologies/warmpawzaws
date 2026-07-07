/**
 * Keep in sync with backend/lambda/src/utils/product-ecommerce-validation.ts MAX_BULK_PRODUCT_ROWS.
 * NOTE: at 2000 rows, Lambda processing time may approach the 15-min hard limit.
 * Validate with a 2000-row test file in dev before deploying.
 */
export const MAX_BULK_PRODUCT_ROWS = 2000;

export function countTitledBulkProducts(products: { name?: string; title?: string }[]): number {
  return products.filter((p) => {
    const t = String(p.name ?? p.title ?? '').trim();
    return t.length > 0;
  }).length;
}

/** Count image URLs in a bulk row (comma/newline separated string or array). */
export function countBulkRowImages(images: unknown): number {
  if (images == null) return 0;
  if (Array.isArray(images)) {
    return images.map((u) => String(u ?? '').trim()).filter(Boolean).length;
  }
  const s = String(images).trim();
  if (!s) return 0;
  return s
    .split(/[,\n]/)
    .map((u) => u.trim())
    .filter(Boolean).length;
}
