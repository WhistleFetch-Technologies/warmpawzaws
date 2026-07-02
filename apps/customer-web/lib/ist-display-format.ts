/**
 * IST display formatters for customer-web UI (bookings, OTP completion lines).
 * Mirrors backend/lambda notification-display-format.ts — Intl only, no date libs.
 * Use explicit Asia/Kolkata and omit timeZoneName to avoid iOS WKWebView "GMT+5:30" suffix.
 */

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_KEY_RE = /^(\d{1,2}):(\d{2})/;

const IST_DATE_OPTS: Intl.DateTimeFormatOptions = {
  timeZone: 'Asia/Kolkata',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
};

const IST_DATETIME_OPTS: Intl.DateTimeFormatOptions = {
  timeZone: 'Asia/Kolkata',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
};

/** e.g. "2026-06-19" → "19 Jun 2026" */
export function formatIstDateDisplay(ymd: string): string {
  const raw = String(ymd || '').trim().slice(0, 10);
  if (!DATE_KEY_RE.test(raw)) return raw;
  const [y, m, d] = raw.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return date.toLocaleDateString('en-IN', IST_DATE_OPTS);
}

/** e.g. "18:30" or "18:30:00" → "6:30 PM" */
export function formatIstTimeDisplay(hhmm: string): string {
  const raw = String(hhmm || '').trim();
  const match = raw.match(TIME_KEY_RE);
  if (!match) return raw;
  let hour = parseInt(match[1], 10);
  const minutes = match[2];
  if (!Number.isFinite(hour)) return raw;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour %= 12;
  if (hour === 0) hour = 12;
  return `${hour}:${minutes} ${ampm}`;
}

/** Booking card: "19 Jun 2026 at 6:30 PM" */
export function formatIstBookingWhen(ymd: string, hhmm: string): string {
  const datePart = formatIstDateDisplay(ymd);
  const timePart = formatIstTimeDisplay(hhmm);
  if (!datePart && !timePart) return '';
  if (!datePart) return timePart;
  if (!timePart) return datePart;
  return `${datePart} at ${timePart}`;
}

/** ISO instant (e.g. otpVerifiedAt) → "19 Jun 2026, 6:30 pm" in IST without GMT label */
export function formatIstInstantDisplay(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return String(iso);
  return date.toLocaleString('en-IN', IST_DATETIME_OPTS);
}

/** Completed tele row: "19 Jun 2026 · Completed 19 Jun 2026, 6:30 pm" */
export function formatIstBookingCompletedLine(
  bookingDateYmd: string,
  completedAtIso: string,
): string {
  const datePart = formatIstDateDisplay(bookingDateYmd);
  const completedPart = formatIstInstantDisplay(completedAtIso);
  if (!datePart) return completedPart ? `Completed ${completedPart}` : '';
  if (!completedPart) return datePart;
  return `${datePart} · Completed ${completedPart}`;
}
