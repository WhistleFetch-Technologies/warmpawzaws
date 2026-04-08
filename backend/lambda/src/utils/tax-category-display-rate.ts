/**
 * Resolve GST % for tax_categories rows across schema variants.
 * Dev DBs often have tax_rate defaulted to 0 while default_gst_rate holds the real rate.
 */

export function toFiniteDbNum(v: unknown): number | undefined {
  if (v == null || v === '') return undefined;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

export function pickTaxCategoryDisplayRate(row: Record<string, unknown>): number {
  const t = toFiniteDbNum(row.tax_rate);
  const d = toFiniteDbNum(row.default_gst_rate);
  const g = toFiniteDbNum(row.gst_rate);
  if (t !== undefined && t !== 0) return t;
  if (t === 0 && d !== undefined && d > 0) return d;
  if (t === 0 && g !== undefined && g > 0) return g;
  if (d !== undefined) return d;
  if (g !== undefined) return g;
  if (t !== undefined) return t;
  return 0;
}

/** When tax_categories rate is 0, use Flexible Tax (gst_rules) rate for that tax_category_id. */
export function applyGstRulesRateFallback(
  resolvedRate: number,
  categoryId: unknown,
  gstRuleRatesByCategoryId: Map<string, number>
): number {
  if (resolvedRate !== 0) return resolvedRate;
  if (categoryId == null || categoryId === '') return 0;
  const fromRule = gstRuleRatesByCategoryId.get(String(categoryId));
  return fromRule !== undefined && fromRule > 0 ? fromRule : 0;
}
