/** IST calendar windows for GET /vendor/:id/earnings (and related vendor money lists). */

export const EARNINGS_PERIOD_TZ = 'Asia/Kolkata';

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export function formatYmdInTimeZone(d: Date, timeZone: string = EARNINGS_PERIOD_TZ): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/** Valid YYYY-MM-DD, else IST today. */
export function resolveEarningsAnchorYmd(raw?: string | null): string {
  const trimmed = String(raw ?? '').trim();
  if (YMD.test(trimmed)) return trimmed;
  return formatYmdInTimeZone(new Date());
}

/** Noon IST on the anchor calendar day — stable for "last 7 days ending here". */
export function earningsAnchorNoonIst(anchorYmd: string): Date {
  const ymd = resolveEarningsAnchorYmd(anchorYmd);
  return new Date(`${ymd}T12:00:00+05:30`);
}

/**
 * Predicate: timestamp in [period start, end of anchor IST day).
 * Anchor defaults to IST today when omitted (same as historical now()-based windows).
 */
export function sqlTimestampInEarningsPeriod(
  period: string,
  columnExpr: string,
  anchorYmd?: string,
): string {
  const col = columnExpr;
  const ymd = resolveEarningsAnchorYmd(anchorYmd);
  const tz = EARNINGS_PERIOD_TZ;
  const dayStart = `('${ymd}'::date AT TIME ZONE '${tz}')`;
  const dayEnd = `(('${ymd}'::date + interval '1 day') AT TIME ZONE '${tz}')`;

  switch (period) {
    case 'day':
      return `(${col} IS NOT NULL AND ${col} >= ${dayStart} AND ${col} < ${dayEnd})`;
    case 'week':
      return `(${col} IS NOT NULL AND ${col} >= (('${ymd}'::date - interval '6 days') AT TIME ZONE '${tz}') AND ${col} < ${dayEnd})`;
    case 'month':
      return `(${col} IS NOT NULL AND ${col} >= (date_trunc('month', '${ymd}'::date) AT TIME ZONE '${tz}') AND ${col} < ${dayEnd})`;
    case 'year':
      return `(${col} IS NOT NULL AND ${col} >= (date_trunc('year', '${ymd}'::date) AT TIME ZONE '${tz}') AND ${col} < ${dayEnd})`;
    default:
      return 'TRUE';
  }
}
