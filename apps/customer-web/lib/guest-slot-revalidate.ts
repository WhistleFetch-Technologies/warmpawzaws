/**
 * Guest-observed slots are intent only. After auth, refetch and drop stale times.
 */

export type PublicSlotHint = {
  time?: string;
  available?: boolean;
};

export function isSelectedSlotStillAvailable(
  selectedTime: string | undefined,
  slots: PublicSlotHint[]
): boolean {
  if (!selectedTime) return false;
  return slots.some((slot) => slot.time === selectedTime && slot.available !== false);
}

export function retainValidRestoredSlot(
  selectedTime: string | undefined,
  slots: PublicSlotHint[]
): string {
  return isSelectedSlotStillAvailable(selectedTime, slots) ? String(selectedTime) : '';
}
