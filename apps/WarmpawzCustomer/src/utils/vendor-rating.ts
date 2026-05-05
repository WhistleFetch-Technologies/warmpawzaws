/** Mobile: never substitute a fake star rating when API omits data. */

export function starRatingOrUndefined(value: unknown): number | undefined {
  const n = typeof value === 'string' ? parseFloat(value) : Number(value);
  if (!Number.isFinite(n) || n <= 0 || n > 5) return undefined;
  return n;
}

/** One-decimal rating for UI, or em dash when unknown / no reviews. */
export function formatRatingOrDash(value: unknown): string {
  const n = starRatingOrUndefined(value);
  return n != null ? n.toFixed(1) : '—';
}
