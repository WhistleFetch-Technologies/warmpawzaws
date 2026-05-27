/** Pack weight (grams) from meal_plans.dietary_requirements — mirrors backend meal-pack-weight.ts */

export function parsePlanDietaryForWeight(plan: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!plan) return {};
  const raw = plan.dietary_requirements;
  if (raw == null) return {};
  if (typeof raw === 'string') {
    try {
      const o = JSON.parse(raw) as unknown;
      return typeof o === 'object' && o != null && !Array.isArray(o) ? (o as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  return {};
}

export function resolvePackWeightGrams(
  plan: Record<string, unknown> | null | undefined,
  dietary?: Record<string, unknown>,
): number | null {
  const col = plan?.pack_weight_grams;
  if (col != null && col !== '') {
    const n = typeof col === 'number' ? col : parseInt(String(col), 10);
    if (Number.isFinite(n) && n >= 1 && n <= 50_000) return n;
  }
  const d = dietary ?? parsePlanDietaryForWeight(plan);
  const keys = ['packWeightGrams', 'pack_weight_grams', 'weightGrams', 'weight_g'] as const;
  for (const k of keys) {
    const v = d[k];
    if (v == null || v === '') continue;
    const n = typeof v === 'number' ? v : parseInt(String(v).trim(), 10);
    if (Number.isFinite(n) && n >= 1 && n <= 50_000) return n;
  }
  return null;
}

export function formatPackWeightLabel(grams: number | null | undefined): string | null {
  if (grams == null || !Number.isFinite(grams) || grams < 1) return null;
  return `${Math.round(grams).toLocaleString('en-IN')} g`;
}
