jest.mock('../../lib/discovery-vendor-query', () => ({
  sqlVendorServiceDiscoverable: () => `(vs.is_enabled = true)`,
}));

import {
  buildDiscoveryListStatsQuery,
  buildDiscoveryListStatsWhere,
  parseVendorServicesLimit,
  toPreviewServiceRow,
  fetchDiscoveryListStatsForVendors,
} from '../discovery-list-stats';

describe('buildDiscoveryListStatsWhere parity fingerprint', () => {
  it('stats and row eligibility share the same fingerprint for the same filter', () => {
    const filter = {
      acceptableStyles: ['at_center'],
      isAtCenter: true,
      catTextExact: ['vet'],
      catTextLike: ['%vet%'],
      catUUIDs: [] as string[],
    };
    const a = buildDiscoveryListStatsWhere(filter);
    const b = buildDiscoveryListStatsWhere(filter);
    expect(a.whereFingerprint).toBe(b.whereFingerprint);
    expect(a.whereSql).toContain('vs.vendor_id = ANY($1::uuid[])');
    expect(a.whereSql).toContain('vs.service_style = ANY($2::text[])');
    expect(a.whereSql).toContain("vs.service_style != 'at_home'");
  });

  it('batch query groups by vendor_id', () => {
    const { sql, buildParams } = buildDiscoveryListStatsQuery({
      acceptableStyles: ['tele'],
      catTextExact: ['nutrition'],
      catTextLike: ['%nutrition%'],
      catUUIDs: [],
    });
    expect(sql).toMatch(/GROUP BY vs\.vendor_id/i);
    expect(sql).toMatch(/COUNT\(\*\)/i);
    const params = buildParams(['v1', 'v2']);
    expect(params[0]).toEqual(['v1', 'v2']);
    expect(params[1]).toEqual(['tele']);
  });
});

describe('parseVendorServicesLimit', () => {
  it('treats missing/NaN as unlimited', () => {
    expect(parseVendorServicesLimit(undefined)).toBeNull();
    expect(parseVendorServicesLimit('')).toBeNull();
    expect(parseVendorServicesLimit('abc')).toBeNull();
  });
  it('clamps finite ints', () => {
    expect(parseVendorServicesLimit('5')).toBe(5);
    expect(parseVendorServicesLimit('0')).toBe(1);
    expect(parseVendorServicesLimit('999')).toBe(100);
  });
});

describe('toPreviewServiceRow', () => {
  it('drops booking-rich duplicates and keeps package fields when needed', () => {
    const preview = toPreviewServiceRow({
      id: 'vs1',
      serviceId: 's1',
      service_id: 's1',
      name: 'Bath',
      service_name: 'Bath',
      price: 499,
      duration: 45,
      category: 'grooming',
      serviceStyle: 'at_center',
      isPackage: true,
      packageDetails: { sessions: 3 },
      shortDescription: 'short',
      longDescription: 'long',
      description: 'desc',
      metadata: { huge: true },
      taxCategoryId: 't1',
      inActivePackage: true,
      activePackagePurchaseId: 'pp1',
    });
    expect(preview.id).toBe('vs1');
    expect(preview.serviceId).toBe('s1');
    expect(preview.packageDetails).toEqual({ sessions: 3 });
    expect(preview.activePackagePurchaseId).toBe('pp1');
    expect(preview.metadata).toBeUndefined();
    expect(preview.longDescription).toBeUndefined();
    expect(preview.service_name).toBeUndefined();
  });
});

describe('fetchDiscoveryListStatsForVendors', () => {
  it('maps GROUP BY rows into a Map', async () => {
    const map = await fetchDiscoveryListStatsForVendors(
      async () => ({
        rows: [
          { vendor_id: 'a', service_count: 3, price_min: 100, price_max: 500 },
          { vendor_id: 'b', service_count: 0, price_min: null, price_max: null },
        ],
      }),
      ['a', 'b'],
      { acceptableStyles: ['at_center'] }
    );
    expect(map.get('a')).toEqual({ serviceCount: 3, priceMin: 100, priceMax: 500 });
    expect(map.get('b')?.serviceCount).toBe(0);
    expect(map.get('b')?.priceMin).toBeUndefined();
  });
});
