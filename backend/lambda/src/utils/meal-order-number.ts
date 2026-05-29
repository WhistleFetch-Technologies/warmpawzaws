const IST = 'Asia/Kolkata';

/** Matches Postgres `generate_order_number('ML')` from migration 200. */
export function generateMealOrderNumber(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST,
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const yy = parts.find((p) => p.type === 'year')?.value ?? '00';
  const mm = parts.find((p) => p.type === 'month')?.value ?? '01';
  const dd = parts.find((p) => p.type === 'day')?.value ?? '01';
  const suffix = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `ML${yy}${mm}${dd}${suffix}`;
}
