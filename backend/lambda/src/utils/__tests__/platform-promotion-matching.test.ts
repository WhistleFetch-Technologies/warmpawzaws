import {
  platformPromoMatchesBookingContext,
  promotionCategoriesMatch,
  promotionServiceTokensMatch,
} from '../platform-promotion-matching';

const normalizeStyle = (raw: unknown): string => {
  const value = String(raw || '').trim().toLowerCase();
  if (!value || value === 'all') return '';
  if (value === 'clinic' || value === 'center' || value === 'at_center') return 'at_center';
  return value;
};

describe('platform-promotion-matching', () => {
  it('matches admin veterinary category to customer vet', () => {
    expect(promotionCategoriesMatch('vet', 'veterinary')).toBe(true);
    expect(promotionCategoriesMatch('vet', 'vet-care')).toBe(true);
    expect(promotionCategoriesMatch('grooming', 'veterinary')).toBe(false);
  });

  it('matches platform promo row targeted at veterinary for vet booking', () => {
    const row = {
      is_active: true,
      published: true,
      service_category: 'veterinary',
      applicable_services: JSON.stringify(['veterinary']),
      discount_type: 'percentage',
      discount_value: 20,
      start_date: '2020-01-01',
      end_date: '2099-12-31',
      applicable_to: 'bookings',
    };
    expect(
      platformPromoMatchesBookingContext(
        row,
        {
          category: 'vet',
          serviceStyle: 'at_center',
          serviceIds: ['vendor-svc-1'],
          amount: 199,
        },
        normalizeStyle
      )
    ).toBe(true);
  });

  it('matches catalog service_id token to vendor_services.id', () => {
    expect(
      promotionServiceTokensMatch(
        ['aaa-vendor-svc'],
        ['bbb-catalog-id'],
        'vet'
      )
    ).toBe(false);
    expect(
      promotionServiceTokensMatch(['bbb-catalog-id'], ['bbb-catalog-id'], 'vet')
    ).toBe(true);
  });
});
