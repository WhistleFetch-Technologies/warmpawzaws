import { resolvePromotionDestination } from '@/lib/promotion-navigation';

describe('resolvePromotionDestination', () => {
  it('routes all + grooming promotion to grooming', () => {
    expect(
      resolvePromotionDestination(
        { service_category: 'grooming' },
        'all'
      )
    ).toBe('grooming');
  });

  it('routes all + training_home style using alias', () => {
    expect(
      resolvePromotionDestination(
        { service_category: 'training', service_style: 'home_visit' },
        'all'
      )
    ).toBe('training_home');
  });

  it('routes boarding category promotion to boarding', () => {
    expect(
      resolvePromotionDestination(
        { service_category: 'boarding' },
        'all'
      )
    ).toBe('boarding');
  });

  it('preserves vet tele direct flow', () => {
    expect(
      resolvePromotionDestination(
        { service_category: 'vet', service_style: 'online' },
        'all'
      )
    ).toBe('vet-tele-consultation');
  });

  it('uses neutral fallback for unresolved target, never vet', () => {
    expect(
      resolvePromotionDestination(
        { name: 'No target promo' },
        'all'
      )
    ).toBe('services');
  });
});
