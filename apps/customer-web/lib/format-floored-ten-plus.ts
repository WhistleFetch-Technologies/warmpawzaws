/**
 * Marketing-style display for non-negative integer counts.
 *
 * - 0 → null (caller hides badge or shows a neutral fallback like "—")
 * - 1–9 → exact "n+" (flooring to tens would give "0+", which is misleading)
 * - 10+ → floor to nearest ten then "+", e.g. 44 → "40+", 36 → "30+"
 */
export function formatFlooredTenPlus(count: number): string | null {
  if (!Number.isFinite(count) || count < 0) return null;
  if (count === 0) return null;
  if (count < 10) return `${Math.floor(count)}+`;
  const floored = Math.floor(count / 10) * 10;
  return `${floored}+`;
}

/** Real provider/centre count for UI (integer, no rounding down to tens). */
export function formatExactCentreCount(count: number): string {
  if (!Number.isFinite(count)) return '—';
  const n = Math.max(0, Math.floor(count));
  return String(n);
}

export type DiscoveryCountStatState = 'loading' | 'error' | 'success';

/** Header/stat helper: loading and errors never show a fake marketing number. */
export function formatDiscoveryCountStat(
  count: number | undefined,
  state: DiscoveryCountStatState
): string {
  if (state === 'loading') return '…';
  if (state === 'error') return '—';
  return formatExactCentreCount(count ?? 0);
}
