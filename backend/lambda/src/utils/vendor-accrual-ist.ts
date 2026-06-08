/**
 * IST calendar month helpers for vendor accrual reports.
 * Month bounds use date strings (YYYY-MM-DD) aligned to Asia/Kolkata calendar months.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type YearMonth = { year: number; month: number };

export function assertYearMonth(year: number, month: number): YearMonth | null {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return null;
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  return { year, month };
}

export function parseYearMonthQuery(yearRaw: string, monthRaw: string): YearMonth | null {
  const year = parseInt(yearRaw, 10);
  const month = parseInt(monthRaw, 10);
  return assertYearMonth(year, month);
}

/** First calendar day of the IST month (inclusive). */
export function istMonthStartYmd(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

/** First calendar day of the next IST month (exclusive upper bound for report_date). */
export function istMonthEndExclusiveYmd(year: number, month: number): string {
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
}

/** All YYYY-MM-DD dates in [month start, next month start). */
export function listIstMonthDays(year: number, month: number): string[] {
  const ym = assertYearMonth(year, month);
  if (!ym) return [];

  const days: string[] = [];
  const cursor = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(month === 12 ? year + 1 : year, month === 12 ? 0 : month, 1));

  while (cursor < end) {
    const y = cursor.getUTCFullYear();
    const m = String(cursor.getUTCMonth() + 1).padStart(2, '0');
    const d = String(cursor.getUTCDate()).padStart(2, '0');
    const ymd = `${y}-${m}-${d}`;
    if (DATE_RE.test(ymd)) days.push(ymd);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

export function assertReportDate(s: string): string | null {
  if (!s || !DATE_RE.test(s)) return null;
  return s;
}
