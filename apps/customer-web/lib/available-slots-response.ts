/**
 * Normalizes GET /customer/vendor/:id/available-slots JSON into UI slot rows.
 * Applies IST past-slot guard when dateYmd is provided.
 */

import { hmInIst, ymdInIst } from './meal-checkout-schedule';

export type NormalizedTimeSlot = {
  time: string;
  available: boolean;
  booked?: boolean;
  isPast?: boolean;
};

export type SlotGuardOptions = {
  minNoticeMinutes?: number;
  now?: Date;
};

const DEFAULT_MIN_NOTICE_MINUTES = 30;

const DEFAULT_FALLBACK_SLOT_TIMES = [
  '09:00',
  '09:30',
  '10:00',
  '10:30',
  '11:00',
  '11:30',
  '14:00',
  '14:30',
  '15:00',
  '15:30',
  '16:00',
  '16:30',
  '17:00',
  '17:30',
] as const;

export function minutesFromHhmm(hhmm: string): number {
  const [hRaw, mRaw] = hhmm.trim().slice(0, 5).split(':');
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

/** Only turns availability OFF for past slots — never sets available: true. */
export function applyPastSlotGuard(
  slots: NormalizedTimeSlot[],
  dateYmd: string,
  options?: SlotGuardOptions
): NormalizedTimeSlot[] {
  const now = options?.now ?? new Date();
  if (dateYmd !== ymdInIst(now)) {
    return slots;
  }

  const minNoticeMinutes = options?.minNoticeMinutes ?? DEFAULT_MIN_NOTICE_MINUTES;
  const currentMinutes = minutesFromHhmm(hmInIst(now));

  return slots.map((slot) => {
    const slotMinutes = minutesFromHhmm(slot.time);
    const isPast = slotMinutes + minNoticeMinutes <= currentMinutes;
    if (isPast) {
      return { ...slot, available: false, isPast: true };
    }
    return slot;
  });
}

export function buildDefaultSlotsWithPastGuard(
  dateYmd: string,
  options?: SlotGuardOptions
): NormalizedTimeSlot[] {
  const base = DEFAULT_FALLBACK_SLOT_TIMES.map((time) => ({
    time,
    available: true,
  }));
  return applyPastSlotGuard(base, dateYmd, options);
}

export function normalizeAvailableSlotsResponse(
  raw: unknown,
  dateYmd?: string,
  options?: SlotGuardOptions
): {
  success: boolean;
  slots: NormalizedTimeSlot[];
  message?: string;
} {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const success = r.success !== false;
  const rawSlots = r.slots;
  const list = Array.isArray(rawSlots) ? rawSlots : [];
  let slots: NormalizedTimeSlot[] = list
    .map((item: unknown): NormalizedTimeSlot | null => {
      if (typeof item === 'string') {
        const t = item.trim().slice(0, 5);
        return t ? { time: t, available: true } : null;
      }
      if (item && typeof item === 'object') {
        const s = item as Record<string, unknown>;
        const time = (s.time ?? s.start_time ?? s.startTime) as string | undefined;
        const t = typeof time === 'string' ? time.trim().slice(0, 5) : '';
        if (!t) return null;
        const booked = s.booked === true;
        const available = !booked && s.available !== false;
        const isPast = s.isPast === true;
        return { time: t, available, booked, ...(isPast ? { isPast: true } : {}) };
      }
      return null;
    })
    .filter((x): x is NormalizedTimeSlot => x !== null);

  if (dateYmd) {
    slots = applyPastSlotGuard(slots, dateYmd, options);
  }

  const message = typeof r.message === 'string' ? r.message : undefined;
  return { success, slots, message };
}

export type NextAvailableSlot = {
  date: string;
  time: string;
  display: string;
};

/** IST calendar date for slot chips — use instead of browser-local when applying past guard. */
export { ymdInIst as formatIstDateYYYYMMDD };

export function isSlotPastInIst(
  dateYmd: string,
  slotHhmm: string,
  options?: SlotGuardOptions
): boolean {
  const now = options?.now ?? new Date();
  if (dateYmd !== ymdInIst(now)) return false;
  const minNoticeMinutes = options?.minNoticeMinutes ?? DEFAULT_MIN_NOTICE_MINUTES;
  const slotMinutes = minutesFromHhmm(slotHhmm);
  const currentMinutes = minutesFromHhmm(hmInIst(now));
  return slotMinutes + minNoticeMinutes <= currentMinutes;
}

function addDaysToYmd(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const base = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  base.setUTCDate(base.getUTCDate() + deltaDays);
  return `${base.getUTCFullYear()}-${String(base.getUTCMonth() + 1).padStart(2, '0')}-${String(base.getUTCDate()).padStart(2, '0')}`;
}

function parse12hTimeToHhmm(s: string): string | null {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(s.trim());
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = m[2];
  const ap = m[3].toUpperCase();
  if (ap === 'PM' && h !== 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${min}`;
}

function parseNextAvailableRaw(raw: unknown): NextAvailableSlot | null {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    const display = raw.trim();
    return display ? { date: '', time: '', display } : null;
  }
  if (typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    const display =
      (typeof o.display === 'string' && o.display) ||
      (typeof o.formattedDisplay === 'string' && o.formattedDisplay) ||
      '';
    const date = typeof o.date === 'string' ? o.date.trim().slice(0, 10) : '';
    const time =
      typeof o.time === 'string'
        ? o.time.trim().slice(0, 5)
        : typeof o.start_time === 'string'
          ? o.start_time.trim().slice(0, 5)
          : '';
    if (display || (date && time)) {
      return { date, time, display: display || `${date} ${time}`.trim() };
    }
  }
  return null;
}

function inferDateYmdFromDisplay(display: string, todayYmd: string): string | null {
  const d = display.trim();
  if (/^Today\b/i.test(d)) return todayYmd;
  if (/^Tomorrow\b/i.test(d)) return addDaysToYmd(todayYmd, 1);
  return null;
}

/** Drops past next-available badges (defense-in-depth vs discovery API). */
export function sanitizeNextAvailable(
  raw: unknown,
  options?: SlotGuardOptions
): NextAvailableSlot | undefined {
  const parsed = parseNextAvailableRaw(raw);
  if (!parsed) return undefined;

  const now = options?.now ?? new Date();
  const todayYmd = ymdInIst(now);

  if (parsed.date && parsed.time && isSlotPastInIst(parsed.date, parsed.time, options)) {
    return undefined;
  }

  if (parsed.display) {
    const inferredDate = inferDateYmdFromDisplay(parsed.display, todayYmd);
    const timeMatch = parsed.display.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
    if (inferredDate && timeMatch) {
      const hhmm = parse12hTimeToHhmm(timeMatch[1]);
      if (hhmm && isSlotPastInIst(inferredDate, hhmm, options)) {
        return undefined;
      }
    }
  }

  return parsed;
}

export function nextAvailableSlotLabel(
  raw: unknown,
  options?: SlotGuardOptions
): string | undefined {
  return sanitizeNextAvailable(raw, options)?.display;
}

/** Resolve label from common discovery payload field names. */
export function resolveNextAvailableLabel(
  source: {
    nextAvailable?: unknown;
    nextAvailableSlot?: unknown;
    nextAvailability?: unknown;
  },
  options?: SlotGuardOptions
): string | undefined {
  for (const raw of [source.nextAvailable, source.nextAvailableSlot, source.nextAvailability]) {
    const label = nextAvailableSlotLabel(raw, options);
    if (label) return label;
  }
  return undefined;
}
