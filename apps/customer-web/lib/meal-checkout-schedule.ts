const IST = 'Asia/Kolkata';

/** Calendar date YYYY-MM-DD in Asia/Kolkata. */
export function ymdInIst(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/** HH:mm in Asia/Kolkata for an instant. */
export function hmInIst(d: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const h = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const m = parts.find((p) => p.type === 'minute')?.value ?? '00';
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
}

export function earliestDeliveryYmd(earliestDeliveryAtIso: string | undefined, leadHours: number): string {
  if (earliestDeliveryAtIso) {
    try {
      return ymdInIst(new Date(earliestDeliveryAtIso));
    } catch {
      /* fall through */
    }
  }
  const t = new Date(Date.now() + leadHours * 3600000);
  return ymdInIst(t);
}

/** Min time (HH:mm) for same-day delivery from earliest instant. */
export function minDeliveryTimeHm(
  scheduledDateYmd: string,
  earliestDeliveryAtIso: string | undefined,
  leadHours: number,
): string | undefined {
  const today = ymdInIst();
  if (scheduledDateYmd !== today) return undefined;
  const earliest = earliestDeliveryAtIso
    ? new Date(earliestDeliveryAtIso)
    : new Date(Date.now() + leadHours * 3600000);
  return hmInIst(earliest);
}
