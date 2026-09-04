import { buildWpayHistoryBreakdownLines } from '../wpay-history-breakdown';

describe('buildWpayHistoryBreakdownLines', () => {
  it('matches checkout lines for a stored tier quote', () => {
    const lines = buildWpayHistoryBreakdownLines({
      paymentId: 'p1',
      vendorId: 'v1',
      vendorName: 'Healing Tails',
      originalAmount: 1000,
      discountPercent: 10,
      discountAmount: 100,
      servicePayableAmount: 900,
      platformFee: 30,
      platformFeeGstAmount: 5.4,
      platformFeeGstRate: 18,
      convenienceFee: 20,
      convenienceGstAmount: 3.6,
      convenienceGstRate: 18,
      payableAmount: 959,
      commercialModel: 'tier_commission',
      paidAt: '2026-09-04T10:00:00.000Z',
    });
    expect(lines.map((l) => l.label)).toEqual([
      'Quoted bill',
      'Offer discount (10% OFF)',
      'Service payable',
      'Platform fee',
      'Platform fee GST (18%)',
      'Convenience fee',
      'Convenience GST (18%)',
      'You paid',
    ]);
    expect(lines[lines.length - 1]).toEqual({
      label: 'You paid',
      amount: 959,
      tone: 'total',
    });
  });

  it('hides fee rows for withhold history without stored fees', () => {
    const lines = buildWpayHistoryBreakdownLines({
      paymentId: 'p2',
      vendorId: 'v2',
      vendorName: 'Clinic',
      originalAmount: 500,
      discountPercent: 5,
      discountAmount: 25,
      payableAmount: 475,
      commercialModel: 'withhold',
      paidAt: '2026-09-04T10:00:00.000Z',
    });
    expect(lines.map((l) => l.label)).toEqual([
      'Quoted bill',
      'Offer discount (5% OFF)',
      'You paid',
    ]);
  });
});
