/**
 * Focused eligibility tests for listing_ownership_scope without loading the
 * full discount-engine / resolver graph (which currently has unrelated TS errors).
 */

import {
  lineMatchesListingOwnershipScope,
  normalizeListingOwnershipScope,
} from '../compute-listing-ownership';

type Line = {
  productId: string;
  listingOwnership?: string | null;
  categoryId?: string;
};

type Promo = {
  listing_ownership_scope?: string;
  applicable_products?: string[];
  applicable_categories?: string[];
  promotion_type?: string;
};

/** Mirrors vendor-promotion-engine.promotionAppliesToLine ownership + product/category gates. */
function applies(promo: Promo, item: Line): boolean {
  if (!lineMatchesListingOwnershipScope(promo.listing_ownership_scope, item.listingOwnership)) {
    return false;
  }
  const products = promo.applicable_products || [];
  const categories = promo.applicable_categories || [];
  if (products.length === 0 && categories.length === 0) return true;
  if (products.length > 0 && products.includes(item.productId)) return true;
  if (categories.length > 0 && item.categoryId && categories.includes(item.categoryId)) {
    return true;
  }
  return false;
}

describe('promo listing_ownership_scope eligibility', () => {
  const lines: Line[] = [
    { productId: 'p1', listingOwnership: 'own_brand' },
    { productId: 'p2', listingOwnership: 'third_party' },
    { productId: 'p3', listingOwnership: null },
  ];

  it('defaults to all via normalize', () => {
    expect(normalizeListingOwnershipScope(undefined)).toBe('all');
    expect(lines.every((l) => applies({ listing_ownership_scope: 'all' }, l))).toBe(true);
  });

  it('own_brand only matches owned products', () => {
    const promo = { listing_ownership_scope: 'own_brand' };
    expect(lines.filter((l) => applies(promo, l)).map((l) => l.productId)).toEqual(['p1']);
  });

  it('third_party only matches third-party products', () => {
    const promo = { listing_ownership_scope: 'third_party' };
    expect(lines.filter((l) => applies(promo, l)).map((l) => l.productId)).toEqual(['p2']);
  });

  it('combines ownership scope with explicit product ids', () => {
    const promo = {
      listing_ownership_scope: 'own_brand',
      applicable_products: ['p1', 'p2'],
    };
    expect(lines.filter((l) => applies(promo, l)).map((l) => l.productId)).toEqual(['p1']);
  });
});
