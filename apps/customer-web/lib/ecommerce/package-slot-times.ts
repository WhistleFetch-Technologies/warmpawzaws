/** HH:mm for comparing package first-day slot times. */
export function normalizePackageSlotTime(t: string): string {
  const s = t.trim();
  if (!s) return '';
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return s.slice(0, 5);
  const hh = String(Math.min(23, Math.max(0, parseInt(m[1], 10)))).padStart(2, '0');
  const mm = String(Math.min(59, Math.max(0, parseInt(m[2], 10)))).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** Indices of slots that share the same normalized time with another slot. */
export function findDuplicateSlotIndices(times: string[]): Set<number> {
  const dupes = new Set<number>();
  const seen = new Map<string, number>();

  times.forEach((raw, idx) => {
    const normalized = normalizePackageSlotTime(raw);
    if (!normalized) return;
    const prior = seen.get(normalized);
    if (prior != null) {
      dupes.add(prior);
      dupes.add(idx);
    } else {
      seen.set(normalized, idx);
    }
  });

  return dupes;
}

export function hasDuplicatePackageSlotTimes(times: string[]): boolean {
  return findDuplicateSlotIndices(times).size > 0;
}

/** True when `candidate` is already chosen on another slot index. */
export function isTimeTakenByOtherSlot(times: string[], idx: number, candidate: string): boolean {
  const normalized = normalizePackageSlotTime(candidate);
  if (!normalized) return false;
  return times.some((t, i) => i !== idx && normalizePackageSlotTime(t) === normalized);
}
