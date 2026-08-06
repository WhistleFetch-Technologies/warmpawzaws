import { computeWpayVendorSettlement, clampWpayWithholdPercent } from '../wpay-vendor-settlement';

describe('wpay-vendor-settlement', () => {
  it('computes withhold and vendor net from payable and percent', () => {
    expect(computeWpayVendorSettlement(900, 5)).toEqual({
      platformWithholdPercent: 5,
      platformWithholdAmount: 45,
      vendorSettlementAmount: 855,
    });
  });

  it('clamps withhold percent to 0-100', () => {
    expect(clampWpayWithholdPercent(150)).toBe(100);
    expect(clampWpayWithholdPercent(-5)).toBe(0);
  });
});
