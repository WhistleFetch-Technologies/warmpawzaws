import { normalizePromoCategory } from '../../../../discount-engine/promo-engine/dsl/category-aliases';

/**
 * Pay Bill promo category:
 * booked slot service wins (grooming at a vet clinic);
 * otherwise vendor onboarded role / legacy category.
 */
export function resolveWpayPromoCategory(opts: {
  bookingCategory?: string | null;
  vendorRoleCategory?: string | null;
  vendorLegacyCategory?: string | null;
}): string {
  const booked = normalizePromoCategory(opts.bookingCategory);
  if (booked) return booked;
  return (
    normalizePromoCategory(opts.vendorRoleCategory) ||
    normalizePromoCategory(opts.vendorLegacyCategory) ||
    ''
  );
}
