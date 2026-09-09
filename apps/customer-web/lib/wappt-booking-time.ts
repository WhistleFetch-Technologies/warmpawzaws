import { formatIstDateYYYYMMDD } from '@/lib/available-slots-response';

export type BookingDateChip = {
  date: string;
  day: string;
  dayNum: number;
  month: string;
};

const IST = 'Asia/Kolkata';

/** Add calendar days to an IST YYYY-MM-DD without browser-local timezone drift. */
export function addIstCalendarDays(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const base = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  base.setUTCDate(base.getUTCDate() + deltaDays);
  return `${base.getUTCFullYear()}-${String(base.getUTCMonth() + 1).padStart(2, '0')}-${String(base.getUTCDate()).padStart(2, '0')}`;
}

function chipFromIstYmd(ymd: string): BookingDateChip {
  const date = new Date(`${ymd}T12:00:00+05:30`);
  return {
    date: ymd,
    day: date.toLocaleDateString('en-US', { weekday: 'short', timeZone: IST }),
    dayNum: Number(date.toLocaleDateString('en-US', { day: 'numeric', timeZone: IST })),
    month: date.toLocaleDateString('en-US', { month: 'short', timeZone: IST }),
  };
}

export function formatTime12Hour(time24: string): string {
  if (!time24) return '';
  const [hRaw, mRaw = '00'] = String(time24).split(':');
  const hour = Number(hRaw);
  const minute = String(mRaw).slice(0, 2);
  if (Number.isNaN(hour)) return time24;
  if (hour === 0) return `12:${minute} AM`;
  if (hour === 12) return `12:${minute} PM`;
  if (hour < 12) return `${hour}:${minute} AM`;
  return `${hour - 12}:${minute} PM`;
}

export function generateBookingDates(count = 7, now = new Date()): BookingDateChip[] {
  const todayYmd = formatIstDateYYYYMMDD(now);
  const dates: BookingDateChip[] = [];
  for (let i = 0; i < count; i++) {
    dates.push(chipFromIstYmd(addIstCalendarDays(todayYmd, i)));
  }
  return dates;
}
