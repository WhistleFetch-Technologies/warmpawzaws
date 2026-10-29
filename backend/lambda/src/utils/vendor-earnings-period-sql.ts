/** IST calendar windows for GET /vendor/:id/earnings (and related vendor money lists). */

export const EARNINGS_PERIOD_TZ = 'Asia/Kolkata';
export const EARNINGS_RANGE_MAX_DAYS = 366;

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const YEAR_MONTH = /^\d{4}-\d{2}$/;

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
  // Bounds must be `timestamp` before AT TIME ZONE. A bare `date` is promoted to timestamptz at
  // session-TZ (UTC) midnight, which shifts the IST start to 11:00.
  const dayStart = `('${ymd}'::timestamp AT TIME ZONE '${tz}')`;
  const dayEnd = `(('${ymd}'::date + interval '1 day') AT TIME ZONE '${tz}')`;

  switch (period) {
    case 'day':
      return `(${col} IS NOT NULL AND ${col} >= ${dayStart} AND ${col} < ${dayEnd})`;
    case 'week':
      return `(${col} IS NOT NULL AND ${col} >= (('${ymd}'::date - interval '6 days') AT TIME ZONE '${tz}') AND ${col} < ${dayEnd})`;
    case 'month':
      return `(${col} IS NOT NULL AND ${col} >= (date_trunc('month', '${ymd}'::timestamp) AT TIME ZONE '${tz}') AND ${col} < ${dayEnd})`;
    case 'year':
      return `(${col} IS NOT NULL AND ${col} >= (date_trunc('year', '${ymd}'::timestamp) AT TIME ZONE '${tz}') AND ${col} < ${dayEnd})`;
    default:
      return 'TRUE';
  }
}

/** Inclusive IST calendar range: [from 00:00, to + 1 day). */
export function sqlTimestampInInclusiveIstRange(
  columnExpr: string,
  fromYmd: string,
  toYmd: string,
): string {
  const from = resolveEarningsAnchorYmd(fromYmd);
  const to = resolveEarningsAnchorYmd(toYmd);
  const tz = EARNINGS_PERIOD_TZ;
  const start = `('${from}'::timestamp AT TIME ZONE '${tz}')`;
  const end = `(('${to}'::date + interval '1 day') AT TIME ZONE '${tz}')`;
  return `(${columnExpr} IS NOT NULL AND ${columnExpr} >= ${start} AND ${columnExpr} < ${end})`;
}

/**
 * Month dropdown: past months are the full IST month.
 * Current IST month is month start through end of today.
 */
export function sqlTimestampInSelectedMonth(
  columnExpr: string,
  yearMonth: string,
  todayYmd?: string,
): string {
  const ym = String(yearMonth || '').trim();
  const today = resolveEarningsAnchorYmd(todayYmd);
  if (!YEAR_MONTH.test(ym)) {
    return sqlTimestampInEarningsPeriod('month', columnExpr, today);
  }
  if (ym === today.slice(0, 7)) {
    return sqlTimestampInEarningsPeriod('month', columnExpr, today);
  }
  const [yearRaw, monthRaw] = ym.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const firstDay = `${ym}-01`;
  const nextMonth =
    month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const tz = EARNINGS_PERIOD_TZ;
  return `(${columnExpr} IS NOT NULL AND ${columnExpr} >= ('${firstDay}'::timestamp AT TIME ZONE '${tz}') AND ${columnExpr} < ('${nextMonth}'::timestamp AT TIME ZONE '${tz}'))`;
}

export type VendorEarningsWindow = {
  period: string;
  scoped: boolean;
  periodSql: (columnExpr: string) => string;
};

export type VendorEarningsWindowError = {
  status: 400;
  code: string;
  message: string;
};

function inclusiveIstDayCount(fromYmd: string, toYmd: string): number {
  const from = new Date(`${fromYmd}T12:00:00+05:30`).getTime();
  const to = new Date(`${toYmd}T12:00:00+05:30`).getTime();
  return Math.floor((to - from) / 86_400_000) + 1;
}

/** Resolve day / week / month / range / lifetime SQL from vendor earnings query params. */
export function resolveVendorEarningsWindow(input: {
  period?: string | null;
  date?: string | null;
  from?: string | null;
  to?: string | null;
  yearMonth?: string | null;
}): { window: VendorEarningsWindow } | { error: VendorEarningsWindowError } {
  const period = String(input.period || 'month').trim() || 'month';

  if (period === 'range') {
    const from = String(input.from || '').trim();
    const to = String(input.to || '').trim();
    if (!YMD.test(from) || !YMD.test(to)) {
      return {
        error: {
          status: 400,
          code: 'INVALID_RANGE',
          message: 'Range requires from and to as YYYY-MM-DD.',
        },
      };
    }
    if (from > to) {
      return {
        error: {
          status: 400,
          code: 'INVALID_RANGE',
          message: 'from must be on or before to.',
        },
      };
    }
    if (inclusiveIstDayCount(from, to) > EARNINGS_RANGE_MAX_DAYS) {
      return {
        error: {
          status: 400,
          code: 'RANGE_TOO_LONG',
          message: `Range cannot exceed ${EARNINGS_RANGE_MAX_DAYS} days.`,
        },
      };
    }
    return {
      window: {
        period: 'range',
        scoped: true,
        periodSql: (columnExpr) => sqlTimestampInInclusiveIstRange(columnExpr, from, to),
      },
    };
  }

  const yearMonth = String(input.yearMonth || '').trim();
  if (period === 'month' && YEAR_MONTH.test(yearMonth)) {
    return {
      window: {
        period: 'month',
        scoped: true,
        periodSql: (columnExpr) => sqlTimestampInSelectedMonth(columnExpr, yearMonth),
      },
    };
  }

  const scoped = period !== 'lifetime';
  const anchor = resolveEarningsAnchorYmd(input.date);
  return {
    window: {
      period,
      scoped,
      periodSql: (columnExpr) =>
        scoped ? sqlTimestampInEarningsPeriod(period, columnExpr, anchor) : 'TRUE',
    },
  };
}
