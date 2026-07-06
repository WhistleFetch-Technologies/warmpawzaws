import { computeFundingAwareSettlement } from '../compute-funding-aware-settlement';
import { deriveWinningOfferByMaxSavings } from '../derive-winning-offer';
import type { DiscountCandidateInput } from '../derive-winning-offer';

const TIER_20 = 20;

function scenario(
  vendorBase: number,
  candidate: DiscountCandidateInput,
  tierRate = TIER_20
) {
  const winning = deriveWinningOfferByMaxSavings(vendorBase, [candidate]);
  return computeFundingAwareSettlement({
    vendorBasePrice: vendorBase,
    winningOffer: winning,
    commissionRate: tierRate,
  });
}

describe('computeFundingAwareSettlement — validation scenarios', () => {
  const vendorBase = 1500;

  it('Scenario A: Platform Promotion 20% — platform bears, base unchanged', () => {
    const result = scenario(vendorBase, {
      offerType: 'PLATFORM_PROMOTION',
      fundingType: 'PLATFORM',
      discountAmount: 300,
    });
    expect(result.commissionBase).toBe(1500);
    expect(result.commissionAmount).toBe(300);
    expect(result.vendorSettlement).toBe(1200);
    expect(result.platformCost).toBe(300);
    expect(result.vendorCost).toBe(0);
  });

  it('Scenario B: Vendor Promotion 25% — vendor bears, base reduced', () => {
    const result = scenario(vendorBase, {
      offerType: 'VENDOR_PROMOTION',
      fundingType: 'VENDOR',
      discountAmount: 375,
    });
    expect(result.commissionBase).toBe(1125);
    expect(result.commissionAmount).toBe(225);
    expect(result.vendorSettlement).toBe(900);
    expect(result.vendorCost).toBe(375);
  });

  it('Scenario C: Vendor Coupon ₹100', () => {
    const result = scenario(vendorBase, {
      offerType: 'VENDOR_COUPON',
      fundingType: 'VENDOR',
      discountAmount: 100,
    });
    expect(result.commissionBase).toBe(1400);
    expect(result.commissionAmount).toBe(280);
    expect(result.vendorSettlement).toBe(1120);
  });

  it('Scenario D: Platform Coupon ₹100', () => {
    const result = scenario(vendorBase, {
      offerType: 'PLATFORM_COUPON',
      fundingType: 'PLATFORM',
      discountAmount: 100,
    });
    expect(result.commissionBase).toBe(1500);
    expect(result.commissionAmount).toBe(300);
    expect(result.vendorSettlement).toBe(1200);
    expect(result.platformCost).toBe(100);
  });

  it('Scenario E: Only winning offer applies (max savings picks vendor promo)', () => {
    const winning = deriveWinningOfferByMaxSavings(vendorBase, [
      { offerType: 'VENDOR_PROMOTION', fundingType: 'VENDOR', discountAmount: 375 },
      { offerType: 'PLATFORM_PROMOTION', fundingType: 'PLATFORM', discountAmount: 300 },
      { offerType: 'VENDOR_COUPON', fundingType: 'VENDOR', discountAmount: 100 },
      { offerType: 'PLATFORM_COUPON', fundingType: 'PLATFORM', discountAmount: 200 },
    ]);
    expect(winning?.offerType).toBe('VENDOR_PROMOTION');
    const result = computeFundingAwareSettlement({
      vendorBasePrice: vendorBase,
      winningOffer: winning,
      commissionRate: TIER_20,
    });
    expect(result.commissionBase).toBe(1125);
    expect(result.vendorSettlement).toBe(900);
  });

  it('Scenario F: Shared funding — only vendor share reduces base', () => {
    const result = scenario(vendorBase, {
      offerType: 'SHARED',
      fundingType: 'SHARED',
      discountAmount: 200,
      vendorShare: 80,
      platformShare: 120,
      sharedSplit: { platformPercent: 60, vendorPercent: 40 },
    });
    expect(result.commissionBase).toBe(1420);
    expect(result.commissionAmount).toBe(284);
    expect(result.vendorSettlement).toBe(1136);
    expect(result.fundingSummary.sharedVendorPaid).toBe(80);
    expect(result.fundingSummary.sharedPlatformPaid).toBe(120);
  });
});
