import {
  isDiscoveryAutoApplyPromotion,
  shouldIncludePromotionForService,
} from '@/lib/promotion-banner-filter';

describe('PromotionBanner filtering', () => {
  it('includes category-specific promotions on home service=all feed', () => {
    const groomingPromo = {
      id: 'promo-grooming',
      name: 'Grooming Offer',
      applicable_services: ['grooming'],
      service_category: 'grooming',
    };

    expect(shouldIncludePromotionForService(groomingPromo as any, 'all')).toBe(true);
    expect(shouldIncludePromotionForService(groomingPromo as any, 'grooming')).toBe(true);
    expect(shouldIncludePromotionForService(groomingPromo as any, 'vet')).toBe(false);
  });

  it('excludes platform coupons from discovery Special Offers', () => {
    expect(
      isDiscoveryAutoApplyPromotion({
        id: 'coupon-1',
        code: 'FLAT500',
        source: 'platform_coupon',
        promotion_type: 'coupon',
      } as any)
    ).toBe(false);
    expect(
      isDiscoveryAutoApplyPromotion({
        id: 'promo-coupon-row',
        name: 'Plat Coupon',
        code: 'FLAT500',
        promotion_type: 'flash_sale',
      } as any)
    ).toBe(false);
    expect(
      isDiscoveryAutoApplyPromotion({
        id: 'promo-1',
        name: 'Vet Offer',
        promotion_type: 'flash_sale',
      } as any)
    ).toBe(true);
  });

  it('matches admin veterinary slug to customer vet service', () => {
    const vetPromo = {
      id: 'promo-vet',
      name: 'Vet Offer',
      applicable_services: ['veterinary'],
      service_category: 'veterinary',
    };

    expect(shouldIncludePromotionForService(vetPromo as any, 'vet')).toBe(true);
    expect(shouldIncludePromotionForService(vetPromo as any, 'grooming')).toBe(false);
  });
});
