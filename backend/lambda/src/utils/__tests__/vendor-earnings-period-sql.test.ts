import {
  EARNINGS_PERIOD_TZ,
  resolveEarningsAnchorYmd,
  sqlTimestampInEarningsPeriod,
} from '../vendor-earnings-period-sql';

describe('vendor earnings period SQL', () => {
  it('accepts YYYY-MM-DD and rejects junk', () => {
    expect(resolveEarningsAnchorYmd('2026-09-04')).toBe('2026-09-04');
    expect(resolveEarningsAnchorYmd('nope')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('windows a calendar day in IST around the anchor, not now()', () => {
    const sql = sqlTimestampInEarningsPeriod('day', 've.realized_at', '2026-09-04');
    expect(sql).toContain("'2026-09-04'::date AT TIME ZONE 'Asia/Kolkata'");
    expect(sql).toContain("'2026-09-04'::date + interval '1 day'");
    expect(sql).not.toContain('now()');
    expect(sql).toContain(EARNINGS_PERIOD_TZ);
  });

  it('caps week and month at end of the anchor day so a past date excludes later credits', () => {
    const week = sqlTimestampInEarningsPeriod('week', 've.realized_at', '2026-09-04');
    const month = sqlTimestampInEarningsPeriod('month', 've.realized_at', '2026-09-04');
    expect(week).toContain("- interval '6 days'");
    expect(week).toContain("'2026-09-04'::date + interval '1 day'");
    expect(month).toContain("date_trunc('month', '2026-09-04'::date)");
    expect(month).toContain("'2026-09-04'::date + interval '1 day'");
  });

  it('lifetime / unknown period is unscoped', () => {
    expect(sqlTimestampInEarningsPeriod('lifetime', 've.realized_at', '2026-09-04')).toBe('TRUE');
  });
});
