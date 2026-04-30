/**
 * Customer boarding flow stores structured intake + disclaimer ack in `bookings.notes` as JSON.
 */

export type BoardingIntakeV1Payload = {
  type: 'boarding_intake_v1';
  submittedAt?: string;
  facilityName?: string;
  vendorId?: string;
  stay?: {
    checkInDate?: string;
    checkOutDate?: string;
    checkInTime?: string;
    checkOutTime?: string;
  };
  intake?: Record<string, unknown>;
  vendorDisclaimer?: {
    acknowledged?: boolean;
    acceptedAt?: string;
    bullets?: string[];
  };
};

export function parseBoardingIntakeV1FromNotes(raw: unknown): BoardingIntakeV1Payload | null {
  if (raw == null || raw === '') return null;
  try {
    const s = typeof raw === 'string' ? raw.trim() : JSON.stringify(raw);
    if (!s.startsWith('{')) return null;
    const o = JSON.parse(s) as BoardingIntakeV1Payload;
    if (o && o.type === 'boarding_intake_v1' && o.intake && typeof o.intake === 'object') return o;
  } catch {
    /* not JSON */
  }
  return null;
}

export function playtimeLabel(v: unknown): string {
  switch (String(v)) {
    case 'once_daily':
      return 'Once a day';
    case 'twice_daily':
      return 'Twice a day';
    case 'every_other_day':
      return 'Every other day';
    default:
      return '';
  }
}
