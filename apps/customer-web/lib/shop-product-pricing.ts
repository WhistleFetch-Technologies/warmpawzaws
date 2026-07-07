/**
 * Shop product pricing: single canonical `price` (SP).
 * Discount badges use compare_at_price only when the promotion engine sets it on the API response.
 */

export function resolveProductCompareAtPrice(
  row: Record<string, unknown>,
): number | undefined {
  const meta =
    row.metadata != null && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : null;

  const candidates = [
    row.original_price,
    row.compare_at_price,
    row.originalPrice,
    row.compareAtPrice,
    meta?.original_price,
    meta?.compare_at_price,
  ];

  for (const raw of candidates) {
    if (raw == null || raw === '') continue;
    const n = parseFloat(String(raw));
    if (Number.isFinite(n) && n > 0) return n;
  }
  return undefined;
}

/** Checkout / display selling price; falls back to MRP when price is missing. */
export function resolveProductSellingPrice(
  row: Record<string, unknown>,
  mrp?: number,
): number {
  const listMrp = mrp ?? resolveProductCompareAtPrice(row);
  const meta =
    row.metadata != null && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : null;

  const candidates = [
    row.price,
    row.selling_price,
    row.sellingPrice,
    meta?.selling_price,
  ];

  for (const raw of candidates) {
    if (raw == null || raw === '') continue;
    const n = parseFloat(String(raw));
    if (!Number.isFinite(n) || n <= 0) continue;
    if (listMrp && n > listMrp) return listMrp;
    return n;
  }
  return listMrp ?? 0;
}

/** True when MRP is strictly greater than selling price (a real discount exists). */
export function productHasListDiscount(
  sellingPrice: number,
  mrp: number | undefined,
): boolean {
  return !!mrp && mrp > sellingPrice;
}

/** MRP for UI strikethrough / % OFF — only when there is a discount. */
export function listPriceForDiscountDisplay(
  sellingPrice: number,
  mrp: number | undefined,
): number | undefined {
  return productHasListDiscount(sellingPrice, mrp) ? mrp : undefined;
}

/** Rounded percent off when compare-at (MRP) is greater than selling price. */
export function getProductDiscountPercent(
  sellingPrice: number,
  compareAtPrice: number | undefined,
): number {
  if (!productHasListDiscount(sellingPrice, compareAtPrice)) return 0;
  return Math.round(((compareAtPrice! - sellingPrice) / compareAtPrice!) * 100);
}
