import {
  formatPayBillEarningsLabel,
  pickEarningsTransactionsForPeriod,
  schedulePeriodToEarningsApiPeriod,
  earningsRequestQuery,
  visibilityToEarningsApiPeriod,
} from '../load-vendor-earnings-summary';

describe('formatPayBillEarningsLabel', () => {
  it('includes the customer name after Pay Bill', () => {
    expect(formatPayBillEarningsLabel('Vedu Gowda')).toBe('Pay Bill → Vedu Gowda');
  });

  it('falls back to Customer when the name is missing', () => {
    expect(formatPayBillEarningsLabel(null)).toBe('Pay Bill → Customer');
    expect(formatPayBillEarningsLabel('   ')).toBe('Pay Bill → Customer');
  });
});

describe('earnings schedule period mapping', () => {
  it('maps Today/Week/Month onto earnings API periods', () => {
    expect(schedulePeriodToEarningsApiPeriod('today')).toBe('day');
    expect(schedulePeriodToEarningsApiPeriod('week')).toBe('week');
    expect(schedulePeriodToEarningsApiPeriod('month')).toBe('month');
  });

  it('uses the selected period list, not lifetime', () => {
    const lifetime = [{ id: 'life-1' }];
    const week = [{ id: 'week-praveen' }];
    const selected = pickEarningsTransactionsForPeriod(
      { day: [], week, month: [], lifetime },
      'week'
    );
    expect(selected).toEqual(week);
    expect(selected).not.toContainEqual({ id: 'life-1' });
  });

  it('sends the calendar date on day/week/month earnings requests', () => {
    expect(earningsRequestQuery('day', '2026-09-04')).toBe('period=day&date=2026-09-04');
    expect(earningsRequestQuery('week', '2026-09-04')).toBe('period=week&date=2026-09-04');
    expect(earningsRequestQuery('lifetime', '2026-09-04')).toBe('period=lifetime');
  });

  it('maps visibility and cursor pages for range and month', () => {
    expect(visibilityToEarningsApiPeriod('today')).toBe('day');
    expect(visibilityToEarningsApiPeriod('range')).toBe('range');
    expect(
      earningsRequestQuery({
        period: 'range',
        from: '2026-10-01',
        to: '2026-10-15',
        cursor: 'abc',
        limit: 5,
      }),
    ).toBe('period=range&from=2026-10-01&to=2026-10-15&cursor=abc&limit=5');
    expect(earningsRequestQuery({ period: 'month', yearMonth: '2026-09', limit: 0 })).toBe(
      'period=month&yearMonth=2026-09&limit=0',
    );
  });
});
