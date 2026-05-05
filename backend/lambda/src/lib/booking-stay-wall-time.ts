/**
 * Stay length for pet sitting / boarding: wall-clock in Asia/Kolkata (+05:30, no DST).
 * Matches customer-web BoardingBookingRouter after aligning to this canonical zone.
 */

/** ISO 8601 offset for India; used so Lambda (UTC) and clients agree on "9:00" wall time. */
export const CANONICAL_APP_TIMEZONE_OFFSET = '+05:30';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const BOARDING_NIGHT_MINUTES = 24 * 60;

export function normalizeBookingTimeForParse(t: string): string {
  const s = String(t || '0:0').trim();
  if (/^\d{1,2}:\d{2}$/.test(s)) return `${s}:00`;
  return s;
}

/**
 * Parses YYYY-MM-DD + HH:MM[:SS] as **Asia/Kolkata** wall time → epoch ms.
 */
export function wallDateTimeToEpochMsKolkata(dateStr: string, timeStr: string): number {
  const d = String(dateStr || '').trim();
  const bt = normalizeBookingTimeForParse(timeStr);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return NaN;
  const iso = `${d}T${bt}${CANONICAL_APP_TIMEZONE_OFFSET}`;
  return new Date(iso).getTime();
}

/**
 * Minutes between check-in and check-out (pet sitting + boarding).
 * If end is not after start on the timeline, adds one calendar day to end (overnight / next-morning checkout).
 */
export function computeStayBilledMinutes(
  bookingDate: string,
  bookingTime: string,
  checkOutDate: string,
  checkOutTime: string
): number {
  const start = wallDateTimeToEpochMsKolkata(bookingDate, bookingTime);
  let end = wallDateTimeToEpochMsKolkata(checkOutDate, checkOutTime);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  if (end <= start) {
    end += MS_PER_DAY;
  }
  return Math.round((end - start) / 60000);
}

/** Boarding: ceil(stay / 24h), minimum 1 unit when minutes > 0. */
export function boardingBilled24hUnits(billedMinutes: number): number {
  const mins = Math.max(0, billedMinutes);
  if (mins < 1) return 0;
  return Math.max(1, Math.ceil(mins / BOARDING_NIGHT_MINUTES));
}

export function computeBoardingStayPriceRupeesPublic(unitPricePerNight: number, billedMinutes: number): number {
  const up = Number.isFinite(unitPricePerNight) ? Math.max(0, unitPricePerNight) : 0;
  const units = boardingBilled24hUnits(billedMinutes);
  if (units < 1) return 0;
  return Math.round(units * up);
}
