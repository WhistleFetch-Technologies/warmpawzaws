import {
  parsePaymentsExportQuery,
  parsePaymentsListQuery,
  wpayPaymentsFilterLabel,
} from '../payments.requests';

describe('payments.requests', () => {
  it('parses month filter for list query', () => {
    const result = parsePaymentsListQuery({
      page: '1',
      pageSize: '5',
      year: '2026',
      month: '8',
    });

    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(5);
    expect(result.dateFilter).toEqual({ mode: 'month', year: 2026, month: 8 });
  });

  it('parses date range filter for list query', () => {
    const result = parsePaymentsListQuery({
      page: '2',
      pageSize: '20',
      fromDate: '2026-08-01',
      toDate: '2026-08-06',
    });

    expect(result.dateFilter).toEqual({
      mode: 'range',
      fromDate: '2026-08-01',
      toDate: '2026-08-06',
    });
  });

  it('prefers month filter when year/month and range are both present', () => {
    const result = parsePaymentsListQuery({
      year: '2026',
      month: '8',
      fromDate: '2026-08-01',
      toDate: '2026-08-06',
    });

    expect(result.dateFilter).toEqual({ mode: 'month', year: 2026, month: 8 });
  });

  it('defaults to no date filter when params are omitted', () => {
    const result = parsePaymentsListQuery({ page: '1' });
    expect(result.dateFilter).toEqual({ mode: 'none' });
  });

  it('rejects invalid month', () => {
    expect(() =>
      parsePaymentsListQuery({ year: '2026', month: '13' }),
    ).toThrow();
  });

  it('rejects range when fromDate is after toDate', () => {
    expect(() =>
      parsePaymentsListQuery({
        fromDate: '2026-08-10',
        toDate: '2026-08-01',
      }),
    ).toThrow();
  });

  it('rejects range longer than 366 days', () => {
    expect(() =>
      parsePaymentsListQuery({
        fromDate: '2024-01-01',
        toDate: '2025-01-02',
      }),
    ).toThrow();
  });

  it('parses export query and builds filter label', () => {
    const result = parsePaymentsExportQuery({ year: '2026', month: '8' });
    expect(result.dateFilter).toEqual({ mode: 'month', year: 2026, month: 8 });
    expect(wpayPaymentsFilterLabel(result.dateFilter)).toBe('2026-08');
  });
});
