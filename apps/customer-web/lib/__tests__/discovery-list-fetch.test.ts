import { clearDiscoveryListCache, isDiscoveryListPath } from '../discovery-list-fetch';

describe('discovery-list-fetch', () => {
  beforeEach(() => {
    clearDiscoveryListCache();
  });

  it('recognizes discover-services and by-style paths', () => {
    expect(isDiscoveryListPath('/customer/discover-services?category=vet')).toBe(true);
    expect(
      isDiscoveryListPath('/customer/services/by-style?style=at_home&category=grooming')
    ).toBe(true);
    expect(isDiscoveryListPath('/customer/vendor/x/services')).toBe(false);
  });
});
