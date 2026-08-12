import { isStorefrontCardView, STOREFRONT_PLP_CARD_SELECT } from '../storefront-plp-select';

describe('storefront-plp-select', () => {
  describe('isStorefrontCardView', () => {
    it('returns true for card and plp', () => {
      expect(isStorefrontCardView('card')).toBe(true);
      expect(isStorefrontCardView('plp')).toBe(true);
      expect(isStorefrontCardView('CARD')).toBe(true);
    });

    it('returns false for empty or unknown view', () => {
      expect(isStorefrontCardView(undefined)).toBe(false);
      expect(isStorefrontCardView('')).toBe(false);
      expect(isStorefrontCardView('full')).toBe(false);
    });
  });

  it('card select omits vendor join and description', () => {
    expect(STOREFRONT_PLP_CARD_SELECT).toContain('p.id');
    expect(STOREFRONT_PLP_CARD_SELECT).toContain('p.name');
    expect(STOREFRONT_PLP_CARD_SELECT).not.toContain('vendor_name');
    expect(STOREFRONT_PLP_CARD_SELECT).not.toContain('description');
  });
});
