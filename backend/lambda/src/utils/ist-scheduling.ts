/**
 * IST (Asia/Kolkata) helpers for slot scheduling — mirrors customer-web guard logic.
 */

const IST = 'Asia/Kolkata';
export const DEFAULT_MIN_NOTICE_MINUTES = 30;

export function ymdInIst(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

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

export function minutesFromHhmm(hhmm: string): number {
  const [hRaw, mRaw] = hhmm.trim().slice(0, 5).split(':');
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

/** Calendar day-of-week 0=Sun … 6=Sat for YYYY-MM-DD (IST calendar date). */
export function dayOfWeekFromYmd(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return 0;
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).getUTCDay();
}

/** Add calendar days to YYYY-MM-DD (no timezone drift; India has no DST). */
export function addDaysToYmd(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const base = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  base.setUTCDate(base.getUTCDate() + deltaDays);
  return `${base.getUTCFullYear()}-${String(base.getUTCMonth() + 1).padStart(2, '0')}-${String(base.getUTCDate()).padStart(2, '0')}`;
}

export function isSlotPastInIst(
  dateYmd: string,
  slotHhmm: string,
  minNoticeMinutes: number = DEFAULT_MIN_NOTICE_MINUTES,
  now: Date = new Date()
): boolean {
  if (dateYmd !== ymdInIst(now)) return false;
  const slotMinutes = minutesFromHhmm(slotHhmm);
  const currentMinutes = minutesFromHhmm(hmInIst(now));
  return slotMinutes < currentMinutes + minNoticeMinutes;
}

export function formatNextAvailableDisplay(
  dateYmd: string,
  timeHhmm: string,
  todayYmd: string
): string {
  const formatted = new Date(`2000-01-01T${timeHhmm.slice(0, 5)}`).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  if (dateYmd === todayYmd) return `Today ${formatted}`;
  const tomorrowYmd = addDaysToYmd(todayYmd, 1);
  if (dateYmd === tomorrowYmd) return `Tomorrow ${formatted}`;
  const [y, m, d] = dateYmd.split('-').map(Number);
  const dateObj = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const [ty, tm, td] = todayYmd.split('-').map(Number);
  const todayUtc = new Date(Date.UTC(ty, tm - 1, td, 12, 0, 0));
  const daysDiff = Math.round((dateObj.getTime() - todayUtc.getTime()) / (24 * 60 * 60 * 1000));
  if (daysDiff >= 2 && daysDiff <= 6) {
    return `${dateObj.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })} ${formatted}`;
  }
  return `${dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })} ${formatted}`;
}
