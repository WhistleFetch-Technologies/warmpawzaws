import {
  acceptableStylesForService,
  filterSearchResultsByDiscoveryRules,
  hubSlugToDiscoveryContext,
  inferHubSlugFromSearchQuery,
  parseUserCoordsFromSearchQuery,
  sqlHubBrowseServiceExistsWithCategory,
  vendorHomeServiceRadiusKm,
  vendorRowIsOnline,
} from '../../lib/search-discovery-parity';
import type { DiscoveryRuleSet } from '../../lib/rule-engine';

const defaultRules: DiscoveryRuleSet = {
  discovery_radius_km: 50,
  discovery_radius_km_home: 10,
  discovery_radius_km_tele: 0,
};

describe('inferHubSlugFromSearchQuery', () => {
  it('maps dog walker text to walker hub', () => {
    expect(inferHubSlugFromSearchQuery('dog walker')).toBe('walker');
    expect(inferHubSlugFromSearchQuery('pet walk')).toBe('walker');
  });

  it('returns null for unrelated queries', () => {
    expect(inferHubSlugFromSearchQuery('veterinary clinic')).toBe('vet');
    expect(inferHubSlugFromSearchQuery('random toys')).toBeNull();
  });
});

describe('hubSlugToDiscoveryContext', () => {
  it('maps walker to at_home + walker role', () => {
    expect(hubSlugToDiscoveryContext('walker')).toEqual({
      discoverCategory: 'walker',
      serviceStyle: 'at_home',
      roleId: 'walker',
    });
  });

  it('maps grooming to at_center', () => {
    expect(hubSlugToDiscoveryContext('grooming')).toMatchObject({
      discoverCategory: 'grooming',
      serviceStyle: 'at_center',
    });
  });

  it('maps nutritionist to tele', () => {
    expect(hubSlugToDiscoveryContext('nutritionist')).toMatchObject({
      serviceStyle: 'tele',
      roleId: 'nutritionist',
    });
  });

  it('returns null for unknown slug', () => {
    expect(hubSlugToDiscoveryContext('unknown_hub')).toBeNull();
  });
});

describe('parseUserCoordsFromSearchQuery', () => {
  it('accepts userLat/userLng and latitude/longitude aliases', () => {
    expect(parseUserCoordsFromSearchQuery({ userLat: '12.9', userLng: '77.6' })).toEqual({
      lat: 12.9,
      lng: 77.6,
    });
    expect(parseUserCoordsFromSearchQuery({ latitude: '12.9', longitude: '77.6' })).toEqual({
      lat: 12.9,
      lng: 77.6,
    });
  });
});

describe('vendorRowIsOnline', () => {
  it('treats false and f as offline', () => {
    expect(vendorRowIsOnline(false)).toBe(false);
    expect(vendorRowIsOnline('f')).toBe(false);
  });
  it('treats null/undefined as online', () => {
    expect(vendorRowIsOnline(null)).toBe(true);
    expect(vendorRowIsOnline(undefined)).toBe(true);
  });
});

describe('acceptableStylesForService', () => {
  it('expands at_center clinic aliases', () => {
    expect(acceptableStylesForService('at_center')).toEqual(
      expect.arrayContaining(['at_center', 'at_clinic'])
    );
  });
});

describe('filterSearchResultsByDiscoveryRules', () => {
  const hub = hubSlugToDiscoveryContext('walker')!;

  it('drops offline vendors', () => {
    const vendors = [
      { id: 'a', latitude: 12.9, longitude: 77.6, is_online: true },
      { id: 'b', latitude: 12.91, longitude: 77.61, is_online: false },
    ];
    const { vendors: out } = filterSearchResultsByDiscoveryRules({
      vendors,
      services: [],
      userCoords: { lat: 12.9, lng: 77.6 },
      hub,
      rules: defaultRules,
      vendorRadiusById: new Map(),
    });
    expect(out.map((v) => v.id)).toEqual(['a']);
  });

  it('excludes walker outside home radius cap', () => {
    const vendors = [
      { id: 'near', latitude: 12.901, longitude: 77.601, distanceKm: 2 },
      { id: 'far', latitude: 13.5, longitude: 78.5, distanceKm: 85 },
    ];
    const vendorRadiusById = new Map([
      ['near', { service_radius: 5 }],
      ['far', { service_radius: 5 }],
    ]);
    const { vendors: out } = filterSearchResultsByDiscoveryRules({
      vendors,
      services: [{ vendorId: 'far' }, { vendorId: 'near' }],
      userCoords: { lat: 12.9, lng: 77.6 },
      hub,
      rules: defaultRules,
      vendorRadiusById,
    });
    expect(out.map((v) => v.id)).toEqual(['near']);
  });

  it('applies at_center platform radius for grooming', () => {
    const groomingHub = hubSlugToDiscoveryContext('grooming')!;
    const vendors = [
      { id: 'in', latitude: 12.91, longitude: 77.61, distanceKm: 5 },
      { id: 'out', latitude: 14.0, longitude: 79.0, distanceKm: 120 },
    ];
    const { vendors: out } = filterSearchResultsByDiscoveryRules({
      vendors,
      services: [],
      userCoords: { lat: 12.9, lng: 77.6 },
      hub: groomingHub,
      rules: { ...defaultRules, discovery_radius_km: 50 },
      vendorRadiusById: new Map(),
    });
    expect(out.map((v) => v.id)).toEqual(['in']);
  });

  it('uses vendor home radius when smaller than platform default', () => {
    const cap = vendorHomeServiceRadiusKm({ service_radius: 3 });
    expect(cap).toBe(3);
    const vendors = [
      { id: 'edge', latitude: 12.93, longitude: 77.63, distanceKm: 4 },
      { id: 'ok', latitude: 12.902, longitude: 77.602, distanceKm: 1 },
    ];
    const { vendors: out } = filterSearchResultsByDiscoveryRules({
      vendors,
      services: [],
      userCoords: { lat: 12.9, lng: 77.6 },
      hub,
      rules: defaultRules,
      vendorRadiusById: new Map([
        ['edge', { service_radius: 3 }],
        ['ok', { service_radius: 3 }],
      ]),
    });
    expect(out.map((v) => v.id)).toEqual(['ok']);
  });

  it('excludes at_home walker vendor with null lat/lng when user coords provided', () => {
    // Vendors without stored coordinates bypass the haversine calculation, leaving
    // distanceKm = null.  For at_home (walker/sitter) services this means we cannot
    // confirm the vendor is within the customer's radius, so they must be excluded —
    // matching discover-services DistanceResolver geocoding behaviour.
    const vendors = [
      { id: 'has-loc', latitude: 12.901, longitude: 77.601, distanceKm: 2 },
      { id: 'no-loc', latitude: null, longitude: null, distanceKm: null },
    ];
    const vendorRadiusById = new Map<string, { service_radius?: unknown }>([
      ['has-loc', { service_radius: 15 }],
      ['no-loc', { service_radius: 15 }],
    ]);
    const { vendors: out } = filterSearchResultsByDiscoveryRules({
      vendors,
      services: [],
      userCoords: { lat: 12.9, lng: 77.6 },
      hub,
      rules: defaultRules,
      vendorRadiusById,
    });
    expect(out.map((v) => v.id)).toEqual(['has-loc']);
  });

  it('does NOT exclude at_center vendor with null lat/lng (relaxed for non-at_home)', () => {
    const groomingHub = hubSlugToDiscoveryContext('grooming')!;
    const vendors = [
      { id: 'has-loc', latitude: 12.901, longitude: 77.601, distanceKm: 5 },
      { id: 'no-loc', latitude: null, longitude: null, distanceKm: null },
    ];
    const { vendors: out } = filterSearchResultsByDiscoveryRules({
      vendors,
      services: [],
      userCoords: { lat: 12.9, lng: 77.6 },
      hub: groomingHub,
      rules: { ...defaultRules, discovery_radius_km: 50 },
      vendorRadiusById: new Map(),
    });
    // Both vendors should pass: the one in range, and the one with unknown distance
    // (at_center services keep the relaxed null-distance pass-through).
    expect(out.map((v) => v.id)).toContain('has-loc');
    expect(out.map((v) => v.id)).toContain('no-loc');
  });
});

describe('sqlHubBrowseServiceExistsWithCategory', () => {
  it('walker SQL includes walkerCategoryDiscoveryOr (service_name fallback)', () => {
    const sql = sqlHubBrowseServiceExistsWithCategory('v', ['at_home'], ['walker', 'pet_walker'], 1, 2, 'walker');
    expect(sql).toContain('%walk%');
    expect(sql).toContain('service_style = ANY($1');
    expect(sql).toContain('= ANY($2');
  });

  it('grooming SQL has no walker name fallback', () => {
    const sql = sqlHubBrowseServiceExistsWithCategory('v', ['at_center'], ['grooming', 'pet_groomer'], 1, 2, 'grooming');
    expect(sql).not.toContain('%walk%');
    expect(sql).toContain('service_style = ANY($1');
  });

  it('SQL does NOT contain role bypass', () => {
    const sql = sqlHubBrowseServiceExistsWithCategory('v', ['at_home'], ['walker'], 1, 2, 'walker');
    expect(sql).not.toContain('role_id');
    expect(sql).not.toContain('roles r_hub');
  });
});
