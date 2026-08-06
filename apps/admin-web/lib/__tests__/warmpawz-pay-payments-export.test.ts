import {
  appendWpayPaymentsDateParams,
  buildWpayPaymentsExportPath,
  currentIstYearMonth,
} from '../warmpawz-pay-payments-export';

describe('warmpawz-pay-payments-export', () => {
  it('builds month query params', () => {
    const qs = new URLSearchParams();
    appendWpayPaymentsDateParams(qs, {
      mode: 'month',
      yearMonth: '2026-08',
      fromDate: '',
      toDate: '',
    });

    expect(qs.get('year')).toBe('2026');
    expect(qs.get('month')).toBe('8');
  });

  it('builds range query params', () => {
    const qs = new URLSearchParams();
    appendWpayPaymentsDateParams(qs, {
      mode: 'range',
      yearMonth: '',
      fromDate: '2026-08-01',
      toDate: '2026-08-06',
    });

    expect(qs.get('fromDate')).toBe('2026-08-01');
    expect(qs.get('toDate')).toBe('2026-08-06');
    expect(qs.get('year')).toBeNull();
  });

  it('builds export path with month filter', () => {
    expect(
      buildWpayPaymentsExportPath({
        mode: 'month',
        yearMonth: '2026-08',
        fromDate: '',
        toDate: '',
      }),
    ).toBe('/admin/warmpawz-pay/payments/export.xlsx?year=2026&month=8');
  });

  it('returns current IST year-month in YYYY-MM format', () => {
    expect(currentIstYearMonth()).toMatch(/^\d{4}-\d{2}$/);
  });
});
