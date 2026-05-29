/**
 * Pack weight (grams) for meal products — meal_plans.pack_weight_grams column (preferred) or dietary JSON.
 */

export function resolvePackWeightGramsFromDietary(
  dietary: Record<string, unknown> | null | undefined,
): number | null {
  if (!dietary || typeof dietary !== 'object') return null;
  const keys = ['packWeightGrams', 'pack_weight_grams', 'weightGrams', 'weight_g'] as const;
  for (const k of keys) {
    const v = dietary[k];
    if (v == null || v === '') continue;
    const n = typeof v === 'number' ? v : parseInt(String(v).trim(), 10);
    if (Number.isFinite(n) && n >= 1 && n <= 50_000) return n;
  }
  const packSize = dietary.packSize;
  if (typeof packSize === 'string' && packSize.trim()) {
    const m = packSize.trim().match(/^(\d{1,5})\s*(?:g|gm|gram|grams)?$/i);
    if (m) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n) && n >= 1 && n <= 50_000) return n;
    }
  }
  return null;
}

export function parseMealPlanDietaryJson(raw: unknown): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const o = JSON.parse(raw) as unknown;
      return typeof o === 'object' && o != null && !Array.isArray(o) ? (o as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return {};
}

export function resolvePackWeightGramsFromPlanRow(
  plan: Record<string, unknown>,
): number | null {
  const col = plan.pack_weight_grams;
  if (col != null && col !== '') {
    const n = typeof col === 'number' ? col : parseInt(String(col), 10);
    if (Number.isFinite(n) && n >= 1 && n <= 50_000) return n;
  }
  return resolvePackWeightGramsFromDietary(parseMealPlanDietaryJson(plan.dietary_requirements));
}
