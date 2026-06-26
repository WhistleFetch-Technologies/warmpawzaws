/**
 * Promotion date bounds in Asia/Kolkata (IST).
 * Calendar dates from vendor forms (YYYY-MM-DD) map to start/end of day IST, stored as UTC ISO.
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function parseCalendarDate(input: string): { y: number; m: number; d: number } | null {
  const trimmed = String(input || '').trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (!match) return null;
  const y = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const d = parseInt(match[3], 10);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { y, m, d };
}

/** IST local midnight on calendar date → UTC Date */
function istStartOfDayUtc(y: number, m: number, d: number): Date {
  const utcMs = Date.UTC(y, m - 1, d, 0, 0, 0, 0) - IST_OFFSET_MS;
  return new Date(utcMs);
}

/** IST 23:59:59.999 on calendar date → UTC Date */
function istEndOfDayUtc(y: number, m: number, d: number): Date {
  const utcMs = Date.UTC(y, m - 1, d, 23, 59, 59, 999) - IST_OFFSET_MS;
  return new Date(utcMs);
}

export function promotionStartDateToIso(input: string): string {
  const parts = parseCalendarDate(input);
  if (!parts) {
    return new Date(input).toISOString();
  }
  return istStartOfDayUtc(parts.y, parts.m, parts.d).toISOString();
}

export function promotionEndDateToIso(input: string): string {
  const parts = parseCalendarDate(input);
  if (!parts) {
    return new Date(input).toISOString();
  }
  return istEndOfDayUtc(parts.y, parts.m, parts.d).toISOString();
}

export function isPromotionLiveInIst(
  startDateIso: string,
  endDateIso: string,
  now: Date = new Date()
): boolean {
  const start = new Date(startDateIso).getTime();
  const end = new Date(endDateIso).getTime();
  const t = now.getTime();
  return t >= start && t <= end;
}
