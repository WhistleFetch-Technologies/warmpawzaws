/**
 * Resolve booking start as UTC epoch ms using vendor-local wall clock (date + time + IANA zone).
 * Aligns with DB trigger semantics: (booking_date || ' ' || booking_time)::timestamp AT TIME ZONE vendor_timezone.
 * Lambda runs in UTC; naive `new Date("YYYY-MM-DDTHH:mm")` would interpret that string in UTC, not IST.
 */

export function normalizeIanaTimeZone(tz: string | null | undefined): string {
  const t = String(tz || '').trim() || 'Asia/Kolkata';
  try {
    Intl.DateTimeFormat(undefined, { timeZone: t });
    return t;
  } catch {
    return 'Asia/Kolkata';
  }
}

function zonedCalendarParts(utcMs: number, timeZone: string) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const p = f.formatToParts(new Date(utcMs));
  const get = (type: string) => +(p.find((x) => x.type === type)?.value || 0);
  return {
    y: get('year'),
    mo: get('month'),
    d: get('day'),
    hh: get('hour'),
    mm: get('minute'),
    ss: get('second'),
  };
}

/** YYYY-MM-DD from DB DATE, ISO string, or Date. */
export function bookingDateToYmd(bookingDate: unknown): string | null {
  if (bookingDate == null) return null;
  if (typeof bookingDate === 'string') {
    const s = bookingDate.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  if (bookingDate instanceof Date && !Number.isNaN(bookingDate.getTime())) {
    return bookingDate.toISOString().slice(0, 10);
  }
  return null;
}

/**
 * UTC instant for civil (wall) date+time in the given IANA zone.
 * Asia/Kolkata uses fixed UTC+5:30 (no DST). Other zones: search around naive UTC anchor.
 */
export function wallDateTimeToUtcMs(
  dateYmd: string,
  timeHms: string,
  vendorTimezone: string | null | undefined
): number | null {
  const ymd = String(dateYmd).match(/^(\d{4})-(\d{2})-(\d{2})/);
  const tm = String(timeHms).trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!ymd || !tm) return null;
  const y = +ymd[1];
  const mo = +ymd[2];
  const d = +ymd[3];
  const hh = +tm[1];
  const mm = +tm[2];
  const ss = +(tm[3] || 0);
  if (![y, mo, d, hh, mm, ss].every((n) => Number.isFinite(n))) return null;
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || hh > 23 || mm > 59 || ss > 59) return null;

  const zone = normalizeIanaTimeZone(vendorTimezone);
  if (zone === 'Asia/Kolkata' || zone === 'Asia/Calcutta') {
    return Date.UTC(y, mo - 1, d, hh, mm, ss) - 5.5 * 3600000;
  }

  const anchor = Date.UTC(y, mo - 1, d, hh, mm, ss);
  const lo = anchor - 40 * 3600000;
  const hi = anchor + 40 * 3600000;
  for (let u = lo; u <= hi; u += 60_000) {
    const z = zonedCalendarParts(u, zone);
    if (z.y === y && z.mo === mo && z.d === d && z.hh === hh && z.mm === mm && z.ss === ss) return u;
  }
  for (let u = lo; u <= hi; u += 1000) {
    const z = zonedCalendarParts(u, zone);
    if (z.y === y && z.mo === mo && z.d === d && z.hh === hh && z.mm === mm && z.ss === ss) return u;
  }
  return null;
}

export function computeHoursUntilBookingStart(booking: {
  booking_date?: string | Date | null;
  booking_time?: string | null;
  vendor_timezone?: string | null;
  booking_datetime?: string | Date | null;
  scheduled_at?: string | Date | null;
}): number {
  const dateYmd = bookingDateToYmd(booking.booking_date);
  const timeStr = booking.booking_time != null ? String(booking.booking_time).trim() : '';

  if (dateYmd && timeStr) {
    const utcMs = wallDateTimeToUtcMs(dateYmd, timeStr, booking.vendor_timezone);
    if (utcMs != null) {
      return (utcMs - Date.now()) / 3600000;
    }
  }

  const fromInstant = (v: string | Date | null | undefined): number | null => {
    if (v == null || v === '') return null;
    const d = v instanceof Date ? v : new Date(v);
    if (Number.isNaN(d.getTime())) return null;
    return (d.getTime() - Date.now()) / 3600000;
  };

  let h = fromInstant(booking.booking_datetime ?? null);
  if (h != null) return h;
  h = fromInstant(booking.scheduled_at ?? null);
  if (h != null) return h;

  if (dateYmd && timeStr) {
    const d = new Date(`${dateYmd}T${timeStr}`);
    if (!Number.isNaN(d.getTime())) return (d.getTime() - Date.now()) / 3600000;
  }

  return NaN;
}
