/**
 * Runtime verification: real UniversalSearchHandler + Hono route, mocked RDS.
 * Run: npx jest src/endpoints/__tests__/search-phase2-runtime.verify.test.ts
 */
// @ts-nocheck
import { Hono } from 'hono';

jest.mock('../../lib/utils/geocode', () => ({
  geocodeAddress: jest.fn(async () => null),
  reverseGeocode: jest.fn(async () => null),
}));
import { registerSearchEndpoints } from '../search';

jest.mock('../../database/rds-connection', () => ({
  query: jest.fn(async (sql: string, params?: unknown[]) => {
    const s = String(sql).toLowerCase();
    const p = (params || []).map((x) => String(x).toLowerCase());

    if (s.includes('search_taxonomy_keywords')) {
      return { rows: [] };
    }

    const hasToken = (t: string) => p.some((x) => x.includes(`%${t}%`));

    if (s.includes('distinct vs.vendor_id')) {
      const ids = (params?.[0] as string[]) || [];
      return { rows: ids.map((vendor_id) => ({ vendor_id })) };
    }

    if (s.includes('from vendor_services vs') && s.includes('join vendors')) {
      if (hasToken('doctor')) {
        return {
          rows: [
            {
              id: 'svc-1',
              vendor_id: 'v-vet-1',
              service_name: 'Doctor Consultation',
              business_name: 'City Vet',
              vendor_profile_image: null,
              vendor_profile_photo_url: null,
              vendor_metadata: null,
              vendor_vendor_type: null,
              vendor_address: null,
              vendor_landmark: null,
              vendor_pincode: null,
              vendor_latitude: null,
              vendor_longitude: null,
              search_role_name: 'Veterinary',
            },
          ],
        };
      }
      if (hasToken('surgery')) {
        return {
          rows: [
            {
              id: 'svc-2',
              vendor_id: 'v-vet-2',
              service_name: 'Pet Surgery',
              business_name: 'Surgery Vet',
              vendor_profile_image: null,
              vendor_profile_photo_url: null,
              vendor_metadata: null,
              vendor_vendor_type: null,
              vendor_address: null,
              vendor_landmark: null,
              vendor_pincode: null,
              vendor_latitude: null,
              vendor_longitude: null,
              search_role_name: 'Veterinary',
            },
          ],
        };
      }
      if (hasToken('grooming')) {
        return {
          rows: [
            {
              id: 'svc-g1',
              vendor_id: 'v-groom-1',
              service_name: 'Dog Grooming',
              business_name: 'Groom Hub',
              vendor_profile_image: null,
              vendor_profile_photo_url: null,
              vendor_metadata: null,
              vendor_vendor_type: null,
              vendor_address: null,
              vendor_landmark: null,
              vendor_pincode: null,
              vendor_latitude: null,
              vendor_longitude: null,
              search_role_name: 'Grooming',
            },
          ],
        };
      }
      if (hasToken('nutrition')) {
        return { rows: [] };
      }
      return { rows: [] };
    }

    if (s.includes('from vendors v')) {
      if (hasToken('dog') && hasToken('doctor')) {
        return { rows: [] };
      }
      if (hasToken('doctor')) {
        return {
          rows: [
            {
              id: 'v-vet-1',
              business_name: 'City Vet Clinic',
              owner_name: 'Dr A',
              specialization: 'General doctor',
              is_active: true,
              status: 'approved',
              is_online: true,
              category: 'veterinary',
              completed_bookings: 10,
              avg_rating: 4.5,
              search_role_name: 'Veterinary',
            },
          ],
        };
      }
      if (hasToken('surgery')) {
        return {
          rows: [
            {
              id: 'v-vet-2',
              business_name: 'Surgery Center',
              owner_name: 'Dr B',
              specialization: 'Surgery',
              is_active: true,
              status: 'approved',
              is_online: true,
              category: 'veterinary',
              completed_bookings: 5,
              avg_rating: 4.2,
              search_role_name: 'Veterinary',
            },
          ],
        };
      }
      if (hasToken('grooming')) {
        return {
          rows: [
            {
              id: 'v-groom-1',
              business_name: 'Groom Studio',
              owner_name: 'G',
              specialization: 'Grooming',
              is_active: true,
              status: 'approved',
              is_online: true,
              category: 'grooming',
              completed_bookings: 3,
              avg_rating: 4.0,
              search_role_name: 'Grooming',
            },
          ],
        };
      }
      const hasIlikeToken = p.some((x) => x.startsWith('%'));
      if (!hasIlikeToken) {
        return {
          rows: [
            {
              id: 'v-vet-browse-1',
              business_name: 'Browse Vet',
              owner_name: 'Dr C',
              specialization: 'General',
              is_active: true,
              status: 'approved',
              is_online: true,
              category: 'veterinary',
              completed_bookings: 1,
              avg_rating: 4.0,
              search_role_name: 'Veterinary',
            },
            {
              id: 'v-vet-browse-2',
              business_name: 'Another Vet',
              owner_name: 'Dr D',
              specialization: 'Clinic',
              is_active: true,
              status: 'approved',
              is_online: true,
              category: 'veterinary',
              completed_bookings: 2,
              avg_rating: 4.1,
              search_role_name: 'Veterinary',
            },
          ],
        };
      }
      return { rows: [] };
    }

    return { rows: [] };
  }),
  select: jest.fn(async () => ({ rows: [] })),
  insert: jest.fn(async () => ({ rows: [] })),
}));

jest.mock('../../utils/opensearch-client', () => {
  throw new Error('opensearch disabled');
});

jest.mock('../../utils/vendor-listing-photo', () => ({
  getVendorListingPhotoUrl: jest.fn(async () => null),
}));

jest.mock('../../lib/rule-engine', () => ({
  getDiscoveryRules: jest.fn(async () => ({
    discovery_radius_km: 50,
    discovery_radius_km_home: 10,
    discovery_radius_km_tele: 0,
  })),
}));

jest.mock('../../lib/discovery-vendor-query', () => {
  const actual = jest.requireActual('../../lib/discovery-vendor-query');
  return {
    ...actual,
    buildDiscoveryVendorExistsSql: jest.fn(async () => ({
      sql: 'TRUE',
      params: [],
      availabilitySql: '',
    })),
  };
});

const QUERIES = [
  'dog doctor',
  'cat doctor',
  'pet clinic',
  'animal hospital',
  'dog grooming',
  'pet nutritionist',
  'pet surgery',
  'vet near me',
];

describe('Phase 2 /search runtime verification (mocked RDS)', () => {
  const app = new Hono();
  registerSearchEndpoints(app);

  it.each(QUERIES)('GET /search?q=%s', async (q) => {
    process.env.ENABLE_OPENSEARCH = 'false';
    const res = await app.request(`http://localhost/search?q=${encodeURIComponent(q)}&limit=20`);
    const body = (await res.json()) as Record<string, unknown>;
    const vendors = body.vendors as unknown[] | undefined;
    const services = body.services as unknown[] | undefined;
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          query: q,
          status: res.status,
          effectiveCategory: body.effectiveCategory,
          taxonomySource: body.taxonomySource,
          searchText: body.searchText,
          categorySource: body.categorySource,
          hubDrivenRetrieval: body.hubDrivenRetrieval,
          total: body.total,
          vendorCount: vendors?.length ?? 0,
          serviceCount: services?.length ?? 0,
          searchMethod: body.searchMethod,
        },
        null,
        2
      )
    );
    expect(res.status).toBe(200);
    expect(body).toHaveProperty('effectiveCategory');
    expect(body).toHaveProperty('taxonomySource');
    expect(body).toHaveProperty('searchText');
    expect(body).toHaveProperty('total');
  });
});
