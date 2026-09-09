import {
  formatPayBillEarningsLabel,
  pickEarningsTransactionsForPeriod,
  schedulePeriodToEarningsApiPeriod,
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
});
