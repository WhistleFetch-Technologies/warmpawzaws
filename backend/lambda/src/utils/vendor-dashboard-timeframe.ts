/** Local calendar YYYY-MM-DD (matches vendor bookings schedule ranges). */
export function formatYmdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Dashboard timeframe ranges aligned with GET /vendor/bookings/:vendorId period filters.
 * - today: single anchor day
 * - week: ISO Mon–Sun containing anchor
 * - month: calendar month containing anchor
 */
export function resolveVendorDashboardTimeframeRange(
  timeframe: string,
  anchorDate?: string
): { startDate: string; endDate: string } {
  const tf = (timeframe || 'today').toLowerCase();
  const anchor =
    anchorDate && /^\d{4}-\d{2}-\d{2}$/.test(anchorDate)
      ? anchorDate
      : formatYmdLocal(new Date());

  if (tf === 'today') {
    return { startDate: anchor, endDate: anchor };
  }

  const d = new Date(`${anchor}T12:00:00`);
  if (tf === 'week') {
    const day = d.getDay();
    const diffToMon = day === 0 ? -6 : 1 - day;
    const mon = new Date(d);
    mon.setDate(d.getDate() + diffToMon);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    return { startDate: formatYmdLocal(mon), endDate: formatYmdLocal(sun) };
  }

  const y = d.getFullYear();
  const m = d.getMonth();
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0);
  return { startDate: formatYmdLocal(start), endDate: formatYmdLocal(end) };
}
