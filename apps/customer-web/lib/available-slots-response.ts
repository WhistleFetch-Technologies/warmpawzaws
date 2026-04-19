/**
 * Normalizes GET /customer/vendor/:id/available-slots JSON into UI slot rows.
 */

export type NormalizedTimeSlot = { time: string; available: boolean; booked?: boolean };

export function normalizeAvailableSlotsResponse(raw: unknown): {
  success: boolean;
  slots: NormalizedTimeSlot[];
  message?: string;
} {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const success = r.success !== false;
  const rawSlots = r.slots;
  const list = Array.isArray(rawSlots) ? rawSlots : [];
  const slots: NormalizedTimeSlot[] = list
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
        return { time: t, available, booked };
      }
      return null;
    })
    .filter((x): x is NormalizedTimeSlot => x !== null);

  const message = typeof r.message === 'string' ? r.message : undefined;
  return { success, slots, message };
}
