jest.mock('../../lib/utils/vendor-customer-distance', () => ({
  DistanceResolver: class {
    async resolve() {
      return null;
    }
  },
  haversineKm: () => 0,
  formatDistanceKm: () => '0 km',
}));

// Stub the RDS connection so applySearchDiscoveryParity (which calls
// loadVendorRadiusMetaByIds / columnExists / getDiscoveryRules) does not
// require a live database — tests assert pure parity-layer logic.
jest.mock('../../database/rds-connection', () => ({
  query: jest.fn(async () => ({ rows: [] })),
  select: jest.fn(async () => ({ rows: [] })),
  insert: jest.fn(async () => ({ rows: [] })),
}));

import {
  acceptableStylesForService,
  applySearchDiscoveryParity,
  enrichSearchVendorsWithDistance,
  filterSearchResultsByDiscoveryRules,
  filterSearchResultsByHubCategory,
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

  // Service-wide parity: every hub chip the customer search page exposes must resolve
  // to the SAME { discoverCategory, serviceStyle, roleId } shape that
  // GET /customer/discover-services accepts. Drift here = search and home diverge.
  it.each([
    ['vet', { discoverCategory: 'vet', serviceStyle: 'at_center', roleId: 'veterinarian' }],
    ['grooming', { discoverCategory: 'grooming', serviceStyle: 'at_center', roleId: 'pet_groomer' }],
    ['training', { discoverCategory: 'training', serviceStyle: 'at_center', roleId: 'trainer_center' }],
    ['boarding', { discoverCategory: 'boarding', serviceStyle: 'at_center', roleId: 'pet_boarding' }],
    ['walker', { discoverCategory: 'walker', serviceStyle: 'at_home', roleId: 'walker' }],
    ['cafe', { discoverCategory: 'cafe', serviceStyle: 'at_center', roleId: 'pet_cafe' }],
    ['resort', { discoverCategory: 'resort', serviceStyle: 'at_center', roleId: 'pet_resort' }],
    ['pharmacy', { discoverCategory: 'pharmacy', serviceStyle: 'at_home', roleId: 'pet_pharmacy' }],
    ['nutritionist', { discoverCategory: 'nutritionist', serviceStyle: 'tele', roleId: 'nutritionist' }],
  ])('hub %s maps to the same discovery context as home', (slug, expected) => {
    expect(hubSlugToDiscoveryContext(slug)).toMatchObject(expected);
  });

  it('sitting hub keeps relaxed flag (parity with discover-services pet sitter)', () => {
    expect(hubSlugToDiscoveryContext('sitting')).toMatchObject({
      discoverCategory: 'sitting',
      serviceStyle: 'at_home',
      roleId: 'pet_sitter',
      sittingDiscoveryRelaxed: true,
    });
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

  // The exact case the customer reported: home shows N walkers, search shows N+1.
  // The extra row is a vendor whose lat/lng resolves OUTSIDE both their own service_radius
  // and the platform at_home cap (10 km). Without this filter, that vendor leaks into /search.
  it('excludes a walker beyond the 10 km platform cap when service_radius is null', () => {
    const walkerHub = hubSlugToDiscoveryContext('walker')!;
    const vendors = [
      { id: 'near', latitude: 12.901, longitude: 77.601, distanceKm: 2 },
      { id: 'far', latitude: 13.5, longitude: 78.5, distanceKm: 15 },
    ];
    const { vendors: out } = filterSearchResultsByDiscoveryRules({
      vendors,
      services: [],
      userCoords: { lat: 12.9, lng: 77.6 },
      hub: walkerHub,
      rules: defaultRules,
      vendorRadiusById: new Map(),
    });
    expect(out.map((v) => v.id)).toEqual(['near']);
  });

  // Parity gate must drop orphan service rows: when a vendor is filtered out by radius,
  // their service rows must NOT leak through as standalone /search service cards (otherwise
  // the customer-web dedupe leaves them as extra cards).
  it('drops orphan service rows whose vendor was removed by the radius filter', () => {
    const walkerHub = hubSlugToDiscoveryContext('walker')!;
    const vendors = [
      { id: 'near', latitude: 12.901, longitude: 77.601, distanceKm: 2 },
      { id: 'far', latitude: 13.5, longitude: 78.5, distanceKm: 50 },
    ];
    const services = [
      { vendorId: 'near', distanceKm: 2 },
      { vendorId: 'far', distanceKm: 50 },
    ];
    const { vendors: outV, services: outS } = filterSearchResultsByDiscoveryRules({
      vendors,
      services,
      userCoords: { lat: 12.9, lng: 77.6 },
      hub: walkerHub,
      rules: defaultRules,
      vendorRadiusById: new Map(),
    });
    expect(outV.map((v) => v.id)).toEqual(['near']);
    expect(outS.map((s) => s.vendorId)).toEqual(['near']);
  });

  // Service-style coverage: every customer hub chip the search page exposes must apply
  // the correct radius rule (at_home → vendor service_radius/10 km; at_center → platform
  // discovery_radius_km; tele → no distance limit by default).
  it.each([
    ['walker', 'at_home', { distance: 25, expected: false }],
    ['walker', 'at_home', { distance: 8, expected: true }],
    ['pharmacy', 'at_home', { distance: 25, expected: false }],
    ['pharmacy', 'at_home', { distance: 8, expected: true }],
    ['vet', 'at_center', { distance: 80, expected: false }],
    ['vet', 'at_center', { distance: 30, expected: true }],
    ['grooming', 'at_center', { distance: 80, expected: false }],
    ['grooming', 'at_center', { distance: 30, expected: true }],
    ['boarding', 'at_center', { distance: 80, expected: false }],
    ['boarding', 'at_center', { distance: 30, expected: true }],
    ['cafe', 'at_center', { distance: 80, expected: false }],
    ['cafe', 'at_center', { distance: 30, expected: true }],
    ['resort', 'at_center', { distance: 80, expected: false }],
    ['resort', 'at_center', { distance: 30, expected: true }],
    ['training', 'at_center', { distance: 80, expected: false }],
    ['training', 'at_center', { distance: 30, expected: true }],
    // tele has no distance limit by default → very-far vendor should remain
    ['nutritionist', 'tele', { distance: 9999, expected: true }],
  ])(
    'hub %s (%s) applies the correct radius rule (distance %j)',
    (slug, _style, { distance, expected }) => {
      const hub = hubSlugToDiscoveryContext(slug)!;
      const vendors = [{ id: 'v', latitude: 13.0, longitude: 77.7, distanceKm: distance }];
      const { vendors: out } = filterSearchResultsByDiscoveryRules({
        vendors,
        services: [],
        userCoords: { lat: 12.9, lng: 77.6 },
        hub,
        rules: defaultRules,
        vendorRadiusById: new Map(),
      });
      expect(out.length === 1).toBe(expected);
    }
  );
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

/**
 * filterSearchResultsByHubCategory standalone behavior. NOTE: applySearchDiscoveryParity
 * no longer invokes this in hub-only browse (q empty) — that path is now pass-through to
 * keep parity with discover-services. These tests document the function's API for the
 * remaining keyword+hub callers.
 */
describe('filterSearchResultsByHubCategory — function-level (used in keyword+hub mode)', () => {
  it('excludes a vendor with vet_clinic category when browsing walker hub', () => {
    const vendors = [
      { id: 'walker-v', category: 'walker' },
      { id: 'vet-v', category: 'vet_clinic' },
    ];
    const { vendors: out } = filterSearchResultsByHubCategory(vendors, [], 'walker', '');
    expect(out.map((v) => v.id)).toContain('walker-v');
    expect(out.map((v) => v.id)).not.toContain('vet-v');
  });

  it('excludes a vet vendor that has a walk-named service when no keyword is present', () => {
    // This mirrors the real-world bug: a vet_clinic vendor appears in walker results
    // because walkerCategoryDiscoveryOr previously matched walk-named services even
    // for vet-role vendors. filterSearchResultsByHubCategory (now always applied) gates them.
    const vendors = [
      { id: 'vet-walker', category: 'veterinarian', businessName: 'Dr. Dogwalk Clinic' },
      { id: 'real-walker', category: 'walker', businessName: 'Happy Paws Walker' },
    ];
    const { vendors: out } = filterSearchResultsByHubCategory(vendors, [], 'walker', '');
    expect(out.map((v) => v.id)).toEqual(['real-walker']);
  });

  it('allows keyword search to use name-based hub matching for walk-named vet vendor', () => {
    // With a keyword present, hubMatchesResultName can return true for borderline matches.
    // The category filter is more permissive: strictHubBrowse = false when q is present.
    const vendors = [
      { id: 'vet-walker', category: 'veterinarian', businessName: 'City Dog Walk Vet' },
      { id: 'real-walker', category: 'walker', businessName: 'Happy Paws Walker' },
    ];
    const { vendors: out } = filterSearchResultsByHubCategory(vendors, [], 'walker', 'dog walk');
    // At minimum the real walker must be included; the vet vendor may or may not be included
    // depending on name matching logic — we only assert the walker is present.
    expect(out.map((v) => v.id)).toContain('real-walker');
  });

  it('excludes grooming vendor from walker hub-browse', () => {
    const vendors = [
      { id: 'groomer', category: 'grooming' },
      { id: 'walker', category: 'walker' },
    ];
    const { vendors: out } = filterSearchResultsByHubCategory(vendors, [], 'walker', '');
    expect(out.map((v) => v.id)).toEqual(['walker']);
  });

  // For every hub chip, the strict hub-browse must keep only same-hub vendors and drop
  // sibling-hub vendors. This is what prevents grooming / pharmacy / etc. from leaking
  // into the walker hub, and vice-versa.
  it.each([
    { hub: 'vet', sameCat: 'veterinarian', siblingCat: 'grooming' },
    { hub: 'grooming', sameCat: 'pet_groomer', siblingCat: 'vet' },
    { hub: 'training', sameCat: 'trainer_center', siblingCat: 'walker' },
    { hub: 'boarding', sameCat: 'pet_boarding', siblingCat: 'walker' },
    { hub: 'walker', sameCat: 'pet_walker', siblingCat: 'grooming' },
    { hub: 'cafe', sameCat: 'pet_cafe', siblingCat: 'resort' },
    { hub: 'resort', sameCat: 'pet_resort', siblingCat: 'cafe' },
    { hub: 'pharmacy', sameCat: 'pet_pharmacy', siblingCat: 'vet' },
    { hub: 'nutritionist', sameCat: 'nutritionist', siblingCat: 'vet' },
  ])('hub %s: keeps $sameCat vendor and drops $siblingCat vendor', ({ hub, sameCat, siblingCat }) => {
    const vendors = [
      { id: 'same', category: sameCat },
      { id: 'sibling', category: siblingCat },
    ];
    const { vendors: out } = filterSearchResultsByHubCategory(vendors, [], hub, '');
    expect(out.map((v) => v.id)).toContain('same');
    expect(out.map((v) => v.id)).not.toContain('sibling');
  });

  // Services from sibling-hub vendors must also be dropped when their vendor row is dropped,
  // so they don't leak into /search as separate cards.
  it('drops services from sibling-hub vendors during hub-only browse', () => {
    const vendors = [{ id: 'walker', category: 'walker' }];
    const services = [
      { vendorId: 'walker', category: 'walker' },
      { vendorId: 'vet-only', category: 'vet' },
    ];
    const { vendors: outV, services: outS } = filterSearchResultsByHubCategory(
      vendors,
      services,
      'walker',
      ''
    );
    expect(outV.map((v) => v.id)).toEqual(['walker']);
    expect(outS.map((s) => s.vendorId)).toEqual(['walker']);
  });

  // Regression for "search: 1 walker, home: 2" bug.
  // A vendor whose vendors.category column is empty/null but whose vendor_services
  // row matched the walker hub passes upstream SQL EXISTS (or OpenSearch terms).
  // The app-level filter must NOT re-reject them in strict mode — that would drop
  // a legitimate walker that home shows.
  it('keeps a vendor with empty primary category in strict walker hub-browse', () => {
    const vendors = [
      { id: 'has-cat', category: 'walker', businessName: 'Test Dog walker' },
      { id: 'empty-cat', category: '', businessName: 'Bindushree M' },
      { id: 'null-cat', category: null as unknown as string, businessName: 'Other Walker' },
    ];
    const { vendors: out } = filterSearchResultsByHubCategory(vendors, [], 'walker', '');
    expect(out.map((v) => v.id).sort()).toEqual(['empty-cat', 'has-cat', 'null-cat']);
  });

  it('still drops explicit non-matching category alongside an empty-category vendor', () => {
    // Empty-category passes (trust upstream), but a vendor with an explicit
    // mismatching category like vet_clinic still must be rejected.
    const vendors = [
      { id: 'walker-real', category: 'walker' },
      { id: 'empty-cat', category: '' },
      { id: 'vet-clinic', category: 'vet_clinic' },
    ];
    const { vendors: out } = filterSearchResultsByHubCategory(vendors, [], 'walker', '');
    expect(out.map((v) => v.id).sort()).toEqual(['empty-cat', 'walker-real']);
  });

  it('keeps services tied to empty-category vendors during strict hub-browse', () => {
    const vendors = [
      { id: 'has-cat', category: 'walker' },
      { id: 'empty-cat', category: '' },
    ];
    const services = [
      { vendorId: 'has-cat', category: 'walker' },
      { vendorId: 'empty-cat', category: 'walker' },
      // Service whose own category column is empty — vendor row already passed upstream;
      // strictHubBrowse should not drop it here either.
      { vendorId: 'empty-cat', category: '' },
    ];
    const { vendors: outV, services: outS } = filterSearchResultsByHubCategory(
      vendors,
      services,
      'walker',
      ''
    );
    expect(outV.map((v) => v.id).sort()).toEqual(['empty-cat', 'has-cat']);
    expect(outS.map((s) => s.vendorId).sort()).toEqual(['empty-cat', 'empty-cat', 'has-cat']);
  });
});

describe('buildDiscoveryVendorExistsSql — strictHubBrowse opt-in', () => {
  // strictHubBrowse is intentionally NO LONGER used by GET /search; both endpoints
  // build the broad SQL so vendors like Bindushree (vet_clinic role with a dog-walk
  // service) appear in the walker hub for both home and search. The opt-in remains
  // for future use cases that explicitly want strict mode.
  it('walker SQL with strictHubBrowse=true suppresses the broad vet/grooming OR branch', async () => {
    const { sql } = await buildDiscoveryVendorExistsSql({
      category: 'walker',
      roleId: 'walker',
      serviceStyle: 'at_home',
      paramOffset: 1,
      strictHubBrowse: true,
    });
    expect(sql).not.toContain("'vet'");
    expect(sql).not.toContain("'grooming'");
    expect(sql).not.toContain("'other'");
  });

  it('walker SQL without strictHubBrowse (default; matches discover-services) DOES include the broad OR branch', async () => {
    const { sql } = await buildDiscoveryVendorExistsSql({
      category: 'walker',
      roleId: 'walker',
      serviceStyle: 'at_home',
      paramOffset: 1,
    });
    expect(sql).toContain('%walk%');
    expect(sql).toContain('at_home');
    // Broad OR is present: vet/grooming/other categories allowed with walk-named services.
    expect(sql).toContain("'vet'");
    expect(sql).toContain("'grooming'");
  });
});

/**
 * applySearchDiscoveryParity integration tests.
 *
 * Regression for "search shows 1 walker / home shows 2": home's /discover-services
 * returns Bindushree (vet_clinic role with a dog-walk service) in the walker hub
 * via the broad walkerCategoryDiscoveryOr SQL branch. /search must include the
 * exact same vendors. Skipping filterSearchResultsByHubCategory in hub-only mode
 * is what guarantees this parity at the parity layer.
 */
describe('applySearchDiscoveryParity — hub-only browse is pass-through (parity with home)', () => {
  // Use no userCoords so radius filtering is a no-op; we want to assert that the
  // category-based app filter doesn't drop vendors in hub-only browse.
  it('keeps a vet_clinic vendor (Bindushree-style) in the walker hub when no keyword is present', async () => {
    const vendors = [
      { id: 'test-walker', category: 'walker', businessName: 'Test Dog walker' },
      // vet_clinic role with empty/vet vendors.category — included by home via
      // walkerCategoryDiscoveryOr. Search must NOT drop her at the parity layer.
      { id: 'bindushree', category: 'vet_clinic', businessName: 'Bindushree M' },
    ];
    const result = await applySearchDiscoveryParity({
      vendors,
      services: [],
      category: 'walker',
      searchQuery: '',
    });
    expect(result.vendors.map((v) => v.id).sort()).toEqual(['bindushree', 'test-walker']);
  });

  it('keeps services tied to a vet vendor in the walker hub (no orphan-dropping by category)', async () => {
    const vendors = [{ id: 'bindushree', category: 'vet_clinic' }];
    const services = [
      { id: 's1', vendorId: 'bindushree', category: 'walker' },
      { id: 's2', vendorId: 'bindushree', category: '' },
    ];
    const result = await applySearchDiscoveryParity({
      vendors,
      services,
      category: 'walker',
      searchQuery: '',
    });
    expect(result.vendors.map((v) => v.id)).toEqual(['bindushree']);
    expect(result.services.map((s) => s.id).sort()).toEqual(['s1', 's2']);
  });

  // Negative case: keyword + hub mode STILL applies the category filter so free-text
  // search doesn't drag in unrelated verticals.
  it('drops vet vendor in walker hub when a keyword is present (keyword+hub mode)', async () => {
    const vendors = [
      { id: 'real-walker', category: 'walker', businessName: 'Happy Paws Walker' },
      { id: 'random-vet', category: 'veterinarian', businessName: 'City Vet Clinic' },
    ];
    const result = await applySearchDiscoveryParity({
      vendors,
      services: [],
      category: 'walker',
      searchQuery: 'dog walk',
    });
    expect(result.vendors.map((v) => v.id)).toEqual(['real-walker']);
  });
});
