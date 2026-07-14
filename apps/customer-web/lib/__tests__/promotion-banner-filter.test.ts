import {
  isDiscoveryAutoApplyPromotion,
  isPlatformCouponPromotion,
} from '@/lib/promotion-banner-filter';

describe('promotion-banner-filter', () => {
  it('treats coded and platform coupons as non auto-apply', () => {
    expect(isPlatformCouponPromotion({ code: 'SAVE10' })).toBe(true);
    expect(isDiscoveryAutoApplyPromotion({ code: 'SAVE10' })).toBe(false);
  });

  it('allows auto-apply promos without codes', () => {
    expect(
      isDiscoveryAutoApplyPromotion({
        promotion_type: 'discount',
      })
    ).toBe(true);
  });

  it('excludes platform coupons from discovery auto-apply', () => {
    expect(
      isDiscoveryAutoApplyPromotion({
        source: 'platform_coupon',
      })
    ).toBe(false);
  });
});
