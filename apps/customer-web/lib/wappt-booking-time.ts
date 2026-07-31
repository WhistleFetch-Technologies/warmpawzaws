import { formatLocalDateYYYYMMDD } from '@/lib/local-calendar-date';

export type BookingDateChip = {
  date: string;
  day: string;
  dayNum: number;
  month: string;
};

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

export function generateBookingDates(count = 7): BookingDateChip[] {
  const dates: BookingDateChip[] = [];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    dates.push({
      date: formatLocalDateYYYYMMDD(date),
      day: date.toLocaleDateString('en-US', { weekday: 'short' }),
      dayNum: date.getDate(),
      month: date.toLocaleDateString('en-US', { month: 'short' }),
    });
  }
  return dates;
}
