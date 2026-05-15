/**
 * Formats a Date as YYYY-MM-DD in the **local** calendar (not UTC).
 * Use for API query params and state that must match on-screen date chips.
 * `toISOString().split('T')[0]` uses UTC and can shift the day in IST and other offsets.
 */
export function formatLocalDateYYYYMMDD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parse `YYYY-MM-DD` as a calendar date in local time (not UTC midnight via `new Date(str)`). */
export function parseYYYYMMDDToLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return new Date(ymd);
  return new Date(y, m - 1, d);
}
