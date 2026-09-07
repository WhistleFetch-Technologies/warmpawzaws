/**
 * Guest-observed slots are intent only. After auth, refetch and drop stale times.
 */

export type PublicSlotHint = {
  time?: string;
  available?: boolean;
};

/** Compare 10:30, 10:30:00, and 10:30 AM as the same slot. */
export function normalizeSlotTime(value: string | undefined): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const ampm = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
  if (ampm) {
    let hours = Number(ampm[1]);
    const minutes = ampm[2];
    const meridem = ampm[3].toUpperCase();
    if (meridem === 'PM' && hours < 12) hours += 12;
    if (meridem === 'AM' && hours === 12) hours = 0;
    return `${String(hours).padStart(2, '0')}:${minutes}`;
  }
  const hm = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?/);
  if (hm) {
    return `${String(hm[1]).padStart(2, '0')}:${hm[2]}`;
  }
  return raw;
}

export function isSelectedSlotStillAvailable(
  selectedTime: string | undefined,
  slots: PublicSlotHint[]
): boolean {
  if (!selectedTime) return false;
  const wanted = normalizeSlotTime(selectedTime);
  return slots.some((slot) => {
    if (slot.available === false) return false;
    const slotTime = normalizeSlotTime(slot.time);
    return slotTime === wanted || slot.time === selectedTime;
  });
}

export function retainValidRestoredSlot(
  selectedTime: string | undefined,
  slots: PublicSlotHint[]
): string {
  return isSelectedSlotStillAvailable(selectedTime, slots) ? String(selectedTime) : '';
}
