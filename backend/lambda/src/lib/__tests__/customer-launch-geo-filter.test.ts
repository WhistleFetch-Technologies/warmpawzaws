jest.mock('../search-discovery-parity', () => ({
  hubSlugToDiscoveryContext: (slug: string) => {
    if (slug === 'vet' || slug === 'veterinary') {
      return { discoverCategory: 'vet', serviceStyle: 'at_center' };
    }
    return null;
  },
  normalizeServiceStyle: (s: string) => s,
}));

import {
  shouldIncludeSearchResult,
  shouldIncludeFeaturedSpotlightRow,
  resolveStyleLaunchTargetForSpotlightScreen,
  type LaunchGeoFilter,
} from '../customer-launch-geo-filter';

function mockFilter(launched: Record<string, boolean>): LaunchGeoFilter {
  return {
    stateCode: 'MH',
    city: 'Pune',
    isStyleLaunched: (serviceId, serviceStyle) =>
      launched[`${serviceId}:${serviceStyle}`] ?? false,
    isHubLaunched: (categorySlug) => {
      if (categorySlug === 'vet') return launched['vet:at_center'] ?? false;
      if (categorySlug === 'grooming') return launched['grooming:at_center'] ?? false;
      return true;
    },
  };
}

describe('shouldIncludeSearchResult', () => {
  it('excludes vet clinic rows when at_center hidden', () => {
    const filter = mockFilter({ 'vet:tele': true, 'vet:at_center': false });
    expect(
      shouldIncludeSearchResult(filter, {
        category: 'vet',
        serviceStyle: 'at_center',
      })
    ).toBe(false);
  });

  it('includes tele vet rows nationwide', () => {
    const filter = mockFilter({ 'vet:tele': true, 'vet:at_center': false });
    expect(
      shouldIncludeSearchResult(filter, {
        category: 'veterinary',
        serviceStyle: 'tele',
      })
    ).toBe(true);
  });
});

describe('shouldIncludeFeaturedSpotlightRow', () => {
  it('drops spotlight rows targeting hidden style screens', () => {
    const filter = mockFilter({ 'vet:at_center': false, 'vet:tele': true });
    expect(
      shouldIncludeFeaturedSpotlightRow(filter, {
        cta_link: '/vet-clinic-list',
        service_category: 'vet',
      })
    ).toBe(false);
  });

  it('keeps generic vet spotlight rows without style screen', () => {
    const filter = mockFilter({ 'vet:at_center': false, 'vet:tele': true });
    expect(
      shouldIncludeFeaturedSpotlightRow(filter, {
        service_category: 'vet',
      })
    ).toBe(true);
  });
});

describe('resolveStyleLaunchTargetForSpotlightScreen', () => {
  it('maps vet clinic list to at_center', () => {
    expect(resolveStyleLaunchTargetForSpotlightScreen('vet-clinic-list')).toEqual({
      serviceId: 'vet',
      serviceStyle: 'at_center',
    });
  });
});
