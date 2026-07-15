/**
 * Promotion date bounds in Asia/Kolkata (IST).
 * Calendar dates from vendor forms (YYYY-MM-DD) map to start/end of day IST, stored as UTC ISO.
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Normalize Date objects (e.g. pg driver rows) to the IST calendar day (YYYY-MM-DD). */
function coerceCalendarInput(input: unknown): string {
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) return '';
    // Stored bounds are IST midnight/EOD as UTC; shift so we recover the IST day.
    return new Date(input.getTime() + IST_OFFSET_MS).toISOString().split('T')[0];
  }
  return String(input ?? '').trim();
}

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

export function promotionStartDateToIso(input: string | Date): string {
  const coerced = coerceCalendarInput(input);
  const parts = parseCalendarDate(coerced);
  if (!parts) {
    const fallback = new Date(coerced);
    if (Number.isNaN(fallback.getTime())) {
      // Never throw RangeError (Invalid time value) on bad input — default to today IST.
      return promotionStartDateToIso(new Date());
    }
    return fallback.toISOString();
  }
  return istStartOfDayUtc(parts.y, parts.m, parts.d).toISOString();
}

export function promotionEndDateToIso(input: string | Date): string {
  const coerced = coerceCalendarInput(input);
  const parts = parseCalendarDate(coerced);
  if (!parts) {
    const fallback = new Date(coerced);
    if (Number.isNaN(fallback.getTime())) {
      return promotionEndDateToIso(new Date());
    }
    return fallback.toISOString();
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
