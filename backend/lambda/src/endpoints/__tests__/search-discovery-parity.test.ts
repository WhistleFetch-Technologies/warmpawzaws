jest.mock('../../lib/utils/vendor-customer-distance', () => ({
  DistanceResolver: class {
    async resolve() {
      return null;
    }
  },
  haversineKm: () => 0,
  formatDistanceKm: () => '0 km',
}));

import {
  acceptableStylesForService,
  enrichSearchVendorsWithDistance,
  filterSearchResultsByDiscoveryRules,
  hubSlugToDiscoveryContext,
  inferHubSlugFromSearchQuery,
  parseUserCoordsFromSearchQuery,
  vendorHomeServiceRadiusKm,
  vendorRowIsOnline,
} from '../../lib/search-discovery-parity';
import {
  buildDiscoveryVendorExistsSql,
  resolveDiscoveryCategoryKeys,
} from '../../lib/discovery-vendor-query';
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

  it('includes at_home walker with null distance (discover parity)', () => {
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
    expect(out.map((v) => v.id)).toContain('has-loc');
    expect(out.map((v) => v.id)).toContain('no-loc');
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
    expect(out.map((v) => v.id)).toContain('has-loc');
    expect(out.map((v) => v.id)).toContain('no-loc');
  });
});

describe('buildDiscoveryVendorExistsSql', () => {
  it('walker SQL includes walkerCategoryDiscoveryOr (service_name fallback)', async () => {
    const { sql } = await buildDiscoveryVendorExistsSql({
      category: 'walker',
      roleId: 'pet_walker',
      serviceStyle: 'at_home',
      paramOffset: 1,
    });
    expect(sql).toContain('%walk%');
    expect(sql).toContain('at_home');
    expect(sql).not.toContain('LOWER(rn.name)');
    expect(sql).not.toContain("= 'walker'");
  });

  it('vet category includes empty-category vet role OR', async () => {
    const { sql } = await buildDiscoveryVendorExistsSql({
      category: 'vet',
      serviceStyle: 'at_center',
      paramOffset: 1,
    });
    expect(sql).toContain('vet_clinic');
    expect(sql).toContain("TRIM(COALESCE(vs.category, '')) = ''");
  });

  it('training category includes training role uncategorized OR', async () => {
    const { sql } = await buildDiscoveryVendorExistsSql({
      category: 'training',
      serviceStyle: 'at_center',
      paramOffset: 1,
      isAtCenter: true,
    });
    expect(sql).toContain('trainer_center');
    expect(sql).toContain('behavioral');
  });

  it('boarding discovery can include category_id OR fragment', async () => {
    const { sql } = await buildDiscoveryVendorExistsSql({
      category: 'boarding',
      roleId: 'pet_boarding',
      serviceStyle: 'at_center',
      paramOffset: 1,
    });
    expect(sql).toContain('pet_boarding');
    expect(sql).toMatch(/category_id|boarding/);
  });

  it('resolveDiscoveryCategoryKeys treats pet_walker role as walker hub keys', () => {
    const keys = resolveDiscoveryCategoryKeys({ category: 'walker', roleId: 'pet_walker' });
    expect(keys.catTextExact).toEqual(expect.arrayContaining(['walker', 'pet_walker']));
  });
});

describe('enrichSearchVendorsWithDistance', () => {
  it('returns vendors unchanged when user coords missing', async () => {
    const vendors = [{ id: 'a', latitude: null, longitude: null }];
    const out = await enrichSearchVendorsWithDistance(vendors, null);
    expect(out).toEqual(vendors);
  });
});
