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
