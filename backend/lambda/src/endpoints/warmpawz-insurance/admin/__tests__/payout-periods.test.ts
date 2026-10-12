import {
  isReminderDay,
  istDateOf,
  listPeriods,
  payoutPeriodStatus,
  periodContaining,
  type PayoutScheduleConfig,
} from '../domain/payout-periods';

const base: PayoutScheduleConfig = {
  frequency: 'monthly',
  anchorDate: '2026-01-01',
  dueDaysAfterPeriodEnd: 7,
  graceDays: 3,
  reminderDaysBefore: [3, 1],
};
const cfg = (patch: Partial<PayoutScheduleConfig>): PayoutScheduleConfig => ({ ...base, ...patch });

describe('periodContaining', () => {
  it('monthly covers the calendar month and handles February in a leap year', () => {
    expect(periodContaining(base, '2026-10-11')).toEqual({
      start: '2026-10-01',
      end: '2026-10-31',
      dueDate: '2026-11-07',
      graceEndsOn: '2026-11-10',
    });
    expect(periodContaining(base, '2028-02-10').end).toBe('2028-02-29');
  });

  it('twice monthly splits on the 15th', () => {
    const c = cfg({ frequency: 'twice_monthly' });
    expect(periodContaining(c, '2026-10-15')).toMatchObject({ start: '2026-10-01', end: '2026-10-15' });
    expect(periodContaining(c, '2026-10-16')).toMatchObject({ start: '2026-10-16', end: '2026-10-31' });
  });

  it('weekly and fortnightly count from the anchor, including dates before it', () => {
    const weekly = cfg({ frequency: 'weekly', anchorDate: '2026-10-05' });
    expect(periodContaining(weekly, '2026-10-11')).toMatchObject({ start: '2026-10-05', end: '2026-10-11' });
    expect(periodContaining(weekly, '2026-10-04')).toMatchObject({ start: '2026-09-28', end: '2026-10-04' });
    const fortnightly = cfg({ frequency: 'fortnightly', anchorDate: '2026-10-05' });
    expect(periodContaining(fortnightly, '2026-10-19')).toMatchObject({ start: '2026-10-19', end: '2026-11-01' });
  });

  it('every two months pairs months from the anchor month across years', () => {
    const c = cfg({ frequency: 'every_two_months', anchorDate: '2026-01-01' });
    expect(periodContaining(c, '2026-10-11')).toMatchObject({ start: '2026-09-01', end: '2026-10-31' });
    expect(periodContaining(c, '2027-01-20')).toMatchObject({ start: '2027-01-01', end: '2027-02-28' });
    const odd = cfg({ frequency: 'every_two_months', anchorDate: '2026-02-01' });
    expect(periodContaining(odd, '2027-01-05')).toMatchObject({ start: '2026-12-01', end: '2027-01-31' });
  });
});

describe('listPeriods', () => {
  it('returns contiguous periods overlapping the range', () => {
    const periods = listPeriods(base, '2026-08-20', '2026-10-11');
    expect(periods.map((p) => p.start)).toEqual(['2026-08-01', '2026-09-01', '2026-10-01']);
  });
});

describe('payoutPeriodStatus', () => {
  const period = periodContaining(base, '2026-09-10');
  const status = (today: string, expected = 100, received = 0) =>
    payoutPeriodStatus({ period, today, expected, received });

  it('moves open → due → grace → overdue', () => {
    expect(status('2026-09-30')).toBe('open');
    expect(status('2026-10-07')).toBe('due');
    expect(status('2026-10-10')).toBe('grace');
    expect(status('2026-10-11')).toBe('overdue');
  });

  it('is paid once the expected amount is received and nothing_due when no policies', () => {
    expect(status('2026-10-11', 100, 100)).toBe('paid');
    expect(status('2026-10-11', 100, 60)).toBe('overdue');
    expect(status('2026-10-11', 0)).toBe('nothing_due');
  });
});

describe('isReminderDay', () => {
  const period = periodContaining(base, '2026-09-10');
  it('matches configured days before the due date and every day after grace', () => {
    expect(isReminderDay(base, period, '2026-10-04')).toBe(true);
    expect(isReminderDay(base, period, '2026-10-05')).toBe(false);
    expect(isReminderDay(base, period, '2026-10-06')).toBe(true);
    expect(isReminderDay(base, period, '2026-10-12')).toBe(true);
    expect(isReminderDay(base, period, '2026-09-28')).toBe(false);
  });
});

describe('istDateOf', () => {
  it('uses the IST calendar day', () => {
    expect(istDateOf('2026-09-30T19:00:00.000Z')).toBe('2026-10-01');
    expect(istDateOf('2026-09-30T18:00:00.000Z')).toBe('2026-09-30');
  });
});
