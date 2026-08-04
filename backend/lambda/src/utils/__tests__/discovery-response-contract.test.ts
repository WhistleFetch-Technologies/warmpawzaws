/**
 * @jest-environment node
 */
import { decodeDiscoveryCursor, encodeDiscoveryCursor } from '../discovery-cursor';
import { toVendorCardDTO } from '../discovery-vendor-card-dto';
import { toServiceCardDTO } from '../discovery-service-card-dto';
import {
  paginateEnrichedVendorPage,
  parseDiscoveryPageLimit,
  resolveVendorListSqlPage,
} from '../discovery-list-pagination';
import { buildVendorListResponse, discoveryCardPriceSortValue } from '../discovery-list-response';

describe('discovery-cursor', () => {
  it('round-trips composite offset', () => {
    const c = encodeDiscoveryCursor({ o: 3, s: 12 });
    expect(decodeDiscoveryCursor(c)).toEqual({ o: 3, s: 12 });
    expect(decodeDiscoveryCursor(null)).toEqual({ o: 0, s: 0 });
    expect(decodeDiscoveryCursor('bad')).toEqual({ o: 0, s: 0 });
  });
});

describe('discovery-vendor-card-dto', () => {
  it('maps slim enriched card without services', () => {
    const dto = toVendorCardDTO({
      vendorId: 'v1',
      name: 'Clinic',
      photoUrl: 'https://x/y.jpg',
      roleDisplayName: 'Vet',
      rating: 4.5,
      reviewCount: 10,
      isVerified: true,
      isOnline: true,
      distanceKm: 2.1,
      distanceText: '2.1 km',
      address: '12 Main St',
      city: 'Mumbai',
      priceMin: 499,
      nextAvailable: { display: 'Today 3pm' },
      services: [],
    });
    expect(dto.id).toBe('v1');
    expect(dto.priceMin).toBe(499);
    expect(dto.availabilityText).toBe('Today 3pm');
    expect((dto as any).services).toBeUndefined();
    expect((dto as any).phone).toBeUndefined();
  });
});

describe('discovery-service-card-dto', () => {
  it('trims long descriptions', () => {
    const long = 'a'.repeat(150);
    const dto = toServiceCardDTO({
      id: 's1',
      name: 'Groom',
      description: long,
      price: 100,
      duration: 30,
      categoryName: 'Grooming',
      isPackage: false,
      serviceStyle: 'at_center',
    });
    expect(dto.shortDescription!.length).toBeLessThanOrEqual(120);
    expect(dto.name).toBe('Groom');
  });
});

describe('discovery-list-pagination', () => {
  it('defaults vendor page to 3', () => {
    const p = resolveVendorListSqlPage(undefined, undefined);
    expect(p.pageSize).toBe(3);
  });

  it('paginates vendor page with cursor when more in db', () => {
    const { page, nextCursor } = paginateEnrichedVendorPage(
      [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }],
      3,
      0,
      12,
      12,
      0
    );
    expect(page).toHaveLength(3);
    expect(nextCursor).toBeTruthy();
  });
});

describe('discovery-list-response', () => {
  it('builds vendors-only envelope', () => {
    const body = buildVendorListResponse({
      style: 'at_home',
      enrichedCards: [
        {
          vendorId: 'v1',
          name: 'A',
          photoUrl: null,
          roleDisplayName: 'Vet',
          rating: 5,
          reviewCount: 1,
          isVerified: true,
          isOnline: false,
          distanceKm: null,
          distanceText: null,
          nextAvailable: { display: 'Soon' },
        },
      ],
      nextCursor: null,
      serviceStyleNorm: 'at_home',
    });
    expect(body.success).toBe(true);
    expect(body.vendors).toHaveLength(1);
    expect((body as any).providers).toBeUndefined();
  });

  it('price sort uses priceMin', () => {
    expect(discoveryCardPriceSortValue({ priceMin: 50 })).toBe(50);
    expect(discoveryCardPriceSortValue({ services: [{ price: 99 }] })).toBe(99);
  });
});

describe('by-style hydration default', () => {
  it('fullEnrich only when query flag set', () => {
    const fullEnrich = (q: Record<string, string | undefined>) =>
      q.fullEnrich === 'true' || q.full === 'true';
    expect(fullEnrich({})).toBe(false);
    expect(fullEnrich({ slim: 'true' })).toBe(false);
    expect(fullEnrich({ fullEnrich: 'true' })).toBe(true);
  });
});
