/**
 * Shop product discount from selling price vs compare-at / original (MRP).
 * Vendor form sends `original_price`; DB column is usually `compare_at_price`.
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

/** Rounded percent off when compare-at (MRP) is greater than selling price. */
export function getProductDiscountPercent(
  sellingPrice: number,
  compareAtPrice: number | undefined,
): number {
  if (!compareAtPrice || compareAtPrice <= sellingPrice) return 0;
  return Math.round(((compareAtPrice - sellingPrice) / compareAtPrice) * 100);
}
