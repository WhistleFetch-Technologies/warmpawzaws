/**
 * Display helpers for canonical meal subscriptions (avoid raw ISO timestamps in UI).
 */

/** Calendar-focused label for subscription "next delivery" / date-only DB values. */
export function formatMealSubscriptionDateOnly(raw: unknown): string {
  if (raw == null || raw === '') return '—';
  const s = String(raw).trim();
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) {
    const y = parseInt(ymd[1], 10);
    const m = parseInt(ymd[2], 10) - 1;
    const d = parseInt(ymd[3], 10);
    return new Date(y, m, d).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
  const t = new Date(s);
  if (!Number.isNaN(t.getTime())) {
    return t.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  }
  return s;
}

/** One line: local calendar date + optional slot range (no `T00:00:00.000Z`). */
export function formatMealSubscriptionSessionLine(
  deliveryDate: unknown,
  slot: { start?: string; end?: string } | undefined,
): string {
  const datePart = formatMealSubscriptionDateOnly(deliveryDate);
  const start = slot?.start?.trim();
  const end = slot?.end?.trim();
  if (start && end) return `${datePart} · ${start} – ${end}`;
  if (start) return `${datePart} · ${start}`;
  return datePart;
}
