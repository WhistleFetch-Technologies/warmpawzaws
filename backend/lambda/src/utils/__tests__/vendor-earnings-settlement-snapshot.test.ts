import { resolveUsableSettlementSnapshot } from '../vendor-earnings-on-completion';

function bookingWithSnapshot(snapshot: Record<string, unknown>): Record<string, unknown> {
  return {
    notes: `wp_financial_meta:${JSON.stringify({
      servicePrice: 10,
      settlementSnapshot: snapshot,
    })}`,
  };
}

describe('resolveUsableSettlementSnapshot', () => {
  it('preserves vendor commission base for a platform-funded coupon', () => {
    const snapshot = resolveUsableSettlementSnapshot(
      bookingWithSnapshot({
        vendorBasePrice: 10,
        winningOffer: {
          offerType: 'PLATFORM_COUPON',
          fundingType: 'PLATFORM',
          discountAmount: 1,
        },
        commissionBase: 10,
        commissionRate: 10,
        commissionAmount: 1,
        vendorSettlement: 9,
        platformCost: 1,
        vendorCost: 0,
      })
    );

    expect(snapshot?.commissionBase).toBe(10);
    expect(snapshot?.vendorSettlement).toBe(9);
  });

  it('reduces vendor commission base for a vendor-funded coupon', () => {
    const snapshot = resolveUsableSettlementSnapshot(
      bookingWithSnapshot({
        vendorBasePrice: 10,
        winningOffer: {
          offerType: 'VENDOR_COUPON',
          fundingType: 'VENDOR',
          discountAmount: 1,
        },
        commissionBase: 9,
        commissionRate: 10,
        commissionAmount: 0.9,
        vendorSettlement: 8.1,
        platformCost: 0,
        vendorCost: 1,
      })
    );

    expect(snapshot?.commissionBase).toBe(9);
    expect(snapshot?.vendorSettlement).toBe(8.1);
  });

  it('rejects inconsistent snapshots and leaves legacy fallback in control', () => {
    const snapshot = resolveUsableSettlementSnapshot(
      bookingWithSnapshot({
        vendorBasePrice: 10,
        commissionBase: 10,
        commissionRate: 10,
        commissionAmount: 1,
        vendorSettlement: 1.46,
      })
    );

    expect(snapshot).toBeNull();
  });
});
