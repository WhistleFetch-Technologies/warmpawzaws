import { shouldIncludePromotionForService } from '@/lib/promotion-banner-filter';

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
});
