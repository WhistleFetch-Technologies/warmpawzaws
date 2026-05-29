export function resolvePackWeightGramsFromMetadata(metadata: Record<string, unknown> | null | undefined): number | null {
  if (!metadata) return null;
  const keys = ['packWeightGrams', 'pack_weight_grams', 'weightGrams', 'weight_g'] as const;
  for (const k of keys) {
    const v = metadata[k];
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
