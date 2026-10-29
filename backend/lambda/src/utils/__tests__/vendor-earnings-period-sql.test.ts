import {
  EARNINGS_PERIOD_TZ,
  resolveEarningsAnchorYmd,
  resolveVendorEarningsWindow,
  sqlTimestampInEarningsPeriod,
  sqlTimestampInInclusiveIstRange,
  sqlTimestampInSelectedMonth,
} from '../vendor-earnings-period-sql';

describe('vendor earnings period SQL', () => {
  it('accepts YYYY-MM-DD and rejects junk', () => {
    expect(resolveEarningsAnchorYmd('2026-09-04')).toBe('2026-09-04');
    expect(resolveEarningsAnchorYmd('nope')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('windows a calendar day in IST around the anchor, not now()', () => {
    const sql = sqlTimestampInEarningsPeriod('day', 've.realized_at', '2026-09-04');
    expect(sql).toContain("'2026-09-04'::timestamp AT TIME ZONE 'Asia/Kolkata'");
    expect(sql).not.toContain("'2026-09-04'::date AT TIME ZONE");
    expect(sql).toContain("'2026-09-04'::date + interval '1 day'");
    expect(sql).not.toContain('now()');
    expect(sql).toContain(EARNINGS_PERIOD_TZ);
  });

  it('caps week and month at end of the anchor day so a past date excludes later credits', () => {
    const week = sqlTimestampInEarningsPeriod('week', 've.realized_at', '2026-09-04');
    const month = sqlTimestampInEarningsPeriod('month', 've.realized_at', '2026-09-04');
    expect(week).toContain("- interval '6 days'");
    expect(week).toContain("'2026-09-04'::date + interval '1 day'");
    expect(month).toContain("date_trunc('month', '2026-09-04'::timestamp)");
    expect(month).toContain("'2026-09-04'::date + interval '1 day'");
  });

  it('lifetime / unknown period is unscoped', () => {
    expect(sqlTimestampInEarningsPeriod('lifetime', 've.realized_at', '2026-09-04')).toBe('TRUE');
  });

  it('windows an inclusive IST date range', () => {
    const sql = sqlTimestampInInclusiveIstRange('ve.realized_at', '2026-09-01', '2026-09-30');
    expect(sql).toContain("'2026-09-01'::timestamp AT TIME ZONE 'Asia/Kolkata'");
    expect(sql).toContain("'2026-09-30'::date + interval '1 day'");
  });

  it('uses a full past month and current month through today', () => {
    const past = sqlTimestampInSelectedMonth('ve.realized_at', '2026-08', '2026-10-29');
    expect(past).toContain("'2026-08-01'::timestamp AT TIME ZONE 'Asia/Kolkata'");
    expect(past).toContain("'2026-09-01'::timestamp AT TIME ZONE 'Asia/Kolkata'");
    const current = sqlTimestampInSelectedMonth('ve.realized_at', '2026-10', '2026-10-29');
    expect(current).toContain("date_trunc('month', '2026-10-29'::timestamp)");
    expect(current).toContain("'2026-10-29'::date + interval '1 day'");
  });

  it('rejects an inverted or overlong range', () => {
    const inverted = resolveVendorEarningsWindow({
      period: 'range',
      from: '2026-10-10',
      to: '2026-10-01',
    });
    expect('error' in inverted).toBe(true);
    const long = resolveVendorEarningsWindow({
      period: 'range',
      from: '2025-01-01',
      to: '2026-12-31',
    });
    expect('error' in long).toBe(true);
  });
});
