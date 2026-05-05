/**
 * Boarding stay length & list price — Asia/Kolkata wall time, same as API `booking-stay-wall-time`.
 */

export const CANONICAL_APP_TIMEZONE_OFFSET = '+05:30';
const BOARDING_NIGHT_MINUTES = 24 * 60;

function normalizeTime(t: string): string {
  const s = String(t || '0:0').trim();
  if (/^\d{1,2}:\d{2}$/.test(s)) return `${s}:00`;
  return s;
}

export function wallDateTimeToEpochMs(dateStr: string, timeStr: string): number {
  const d = String(dateStr || '').trim();
  const bt = normalizeTime(timeStr);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return NaN;
  return new Date(`${d}T${bt}${CANONICAL_APP_TIMEZONE_OFFSET}`).getTime();
}

export function computeStayBilledMinutes(
  checkInDate: string,
  checkInTime: string,
  checkOutDate: string,
  checkOutTime: string
): number {
  const start = wallDateTimeToEpochMs(checkInDate, checkInTime);
  let end = wallDateTimeToEpochMs(checkOutDate, checkOutTime);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  if (end <= start) {
    end += 24 * 60 * 60 * 1000;
  }
  return Math.round((end - start) / 60000);
}

export function boardingBilled24hUnits(billedMinutes: number): number {
  const mins = Math.max(0, billedMinutes);
  if (mins < 1) return 0;
  return Math.max(1, Math.ceil(mins / BOARDING_NIGHT_MINUTES));
}

export function computeBoardingListTotalRupees(unitPricePer24h: number, billedMinutes: number): number {
  const up = Number.isFinite(unitPricePer24h) ? Math.max(0, unitPricePer24h) : 0;
  const units = boardingBilled24hUnits(billedMinutes);
  if (units < 1) return 0;
  return Math.round(units * up);
}
