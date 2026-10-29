import { mapVendorEarningsExportRow, VENDOR_EARNINGS_EXPORT_HEADERS } from '../vendor-earnings-export.xlsx';

describe('vendor earnings export columns', () => {
  it('keeps the five on-screen columns only', () => {
    expect(VENDOR_EARNINGS_EXPORT_HEADERS).toEqual([
      'Customer',
      'Channel',
      'Date/time (IST)',
      'Amount to receive',
      'Status',
    ]);
  });

  it('labels Pay Bill separately and does not include commission or phone', () => {
    const row = mapVendorEarningsExportRow({
      customerName: 'Vedu Gowda',
      serviceName: 'Pay Bill',
      flowType: 'pay_bill',
      realizedAt: '2026-10-08T06:30:00.000Z',
      amount: 850,
      status: 'pending',
    });
    expect(row[0]).toBe('Vedu Gowda');
    expect(row[1]).toBe('Pay Bill');
    expect(row[3]).toBe(850);
    expect(row[4]).toBe('pending');
    expect(row).toHaveLength(5);
  });
});
