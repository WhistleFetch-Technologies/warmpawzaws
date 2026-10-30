import { mapHubSlugToWpayCategory } from '../map-hub-slug-to-wpay-category';

describe('mapHubSlugToWpayCategory', () => {
  it('maps walk-in store aliases to the Store chip', () => {
    expect(mapHubSlugToWpayCategory('store')).toBe('store');
    expect(mapHubSlugToWpayCategory('pet_store')).toBe('store');
    expect(mapHubSlugToWpayCategory('pet_store_walkin')).toBe('store');
  });

  it('does not map shop to store', () => {
    expect(mapHubSlugToWpayCategory('shop')).toBeNull();
    expect(mapHubSlugToWpayCategory('grooming')).toBe('grooming');
  });
});
