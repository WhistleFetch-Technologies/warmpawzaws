/**
 * IST display formatters for push/SMS/in-app notification copy.
 * Booking wall-clock values are stored as YYYY-MM-DD + HH:MM (Asia/Kolkata intent).
 * Uses Intl only — no heavy date libraries.
 */

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_KEY_RE = /^(\d{1,2}):(\d{2})/;

/** e.g. "2026-06-19" → "19 Jun 2026" */
export function formatIstDateDisplay(ymd: string): string {
  const raw = String(ymd || '').trim().slice(0, 10);
  if (!DATE_KEY_RE.test(raw)) return raw;
  const [y, m, d] = raw.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return date.toLocaleDateString('en-IN', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** e.g. "18:30" → "6:30 PM" (12h; input is IST wall-clock HH:MM) */
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

/** e.g. "19 Jun 2026 at 6:30 PM" */
export function formatIstBookingWhen(ymd: string, hhmm: string): string {
  const datePart = formatIstDateDisplay(ymd);
  const timePart = formatIstTimeDisplay(hhmm);
  if (!datePart && !timePart) return '';
  if (!datePart) return timePart;
  if (!timePart) return datePart;
  return `${datePart} at ${timePart}`;
}

const DATE_TEMPLATE_KEYS = ['date', 'oldDate', 'newDate', 'bookingDate'] as const;
const TIME_TEMPLATE_KEYS = ['time', 'oldTime', 'newTime', 'bookingTime'] as const;

/**
 * Format known date/time template variables for NOTIFICATION_TEMPLATES substitution.
 * Preserves raw values in `*_raw` keys for debugging/audit if needed.
 */
export function enrichTemplateDataWithIstDisplay(
  data: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!data) return {};
  const out: Record<string, unknown> = { ...data };

  const pickRawDate = (): string =>
    String(data.date ?? data.bookingDate ?? data.newDate ?? data.oldDate ?? '').trim();
  const pickRawTime = (): string =>
    String(data.time ?? data.bookingTime ?? data.newTime ?? data.oldTime ?? '').trim();

  const rawDate = pickRawDate();
  const rawTime = pickRawTime();
  if (rawDate && rawTime) {
    out.bookingDateTime = formatIstBookingWhen(rawDate, rawTime);
  }

  for (const key of DATE_TEMPLATE_KEYS) {
    if (out[key] != null && String(out[key]).trim()) {
      out[`${key}_raw`] = out[key];
      out[key] = formatIstDateDisplay(String(out[key]));
    }
  }
  for (const key of TIME_TEMPLATE_KEYS) {
    if (out[key] != null && String(out[key]).trim()) {
      out[`${key}_raw`] = out[key];
      out[key] = formatIstTimeDisplay(String(out[key]));
    }
  }

  return out;
}

/** Relative or absolute IST label for inbox API (optional). */
export function formatIstRelativeOrAbsolute(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 60) return `${Math.max(0, diffMins)}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
