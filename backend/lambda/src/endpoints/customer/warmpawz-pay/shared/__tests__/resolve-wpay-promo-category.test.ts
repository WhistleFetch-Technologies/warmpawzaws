import { resolveWpayPromoCategory } from '../resolve-wpay-promo-category';

describe('resolveWpayPromoCategory', () => {
  it('uses vendor onboarded category for walk-in Pay Bill', () => {
    expect(
      resolveWpayPromoCategory({
        vendorRoleCategory: 'vet',
        vendorLegacyCategory: 'clinic',
      })
    ).toBe('veterinary');
  });

  it('uses booked grooming over onboarded vet', () => {
    expect(
      resolveWpayPromoCategory({
        bookingCategory: 'grooming',
        vendorRoleCategory: 'vet',
      })
    ).toBe('grooming');
  });

  it('ignores WPAY as a category token', () => {
    expect(
      resolveWpayPromoCategory({
        bookingCategory: 'WPAY',
        vendorRoleCategory: 'veterinary',
      })
    ).toBe('veterinary');
  });
});
