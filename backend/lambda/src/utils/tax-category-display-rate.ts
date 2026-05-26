/**
 * Resolve GST % for tax_categories rows across schema variants.
 * Dev DBs often have tax_rate defaulted to 0 while default_gst_rate holds the real rate.
 */

export function toFiniteDbNum(v: unknown): number | undefined {
  if (v == null || v === '') return undefined;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

export type GstApplicationScope = 'service_booking' | 'meal_plan_food' | 'meal_plan_delivery';

export function parseGstApplicationScope(raw: unknown): GstApplicationScope {
  const s = String(raw ?? '').trim();
  if (s === 'meal_plan_food') return 'meal_plan_food';
  if (s === 'meal_plan_delivery') return 'meal_plan_delivery';
  return 'service_booking';
}

export function isMealPlanGstScope(scope: GstApplicationScope): boolean {
  return scope === 'meal_plan_food' || scope === 'meal_plan_delivery';
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
