jest.mock('../../services/image', () => ({
  mapWithConcurrency: async <T, R>(
    items: T[],
    _concurrency: number,
    fn: (item: T, index: number) => Promise<R>
  ) => Promise.all(items.map((item, i) => fn(item, i))),
}));
jest.mock('../vendor-listing-photo', () => ({
  getVendorListingPhotoUrl: jest.fn(async () => null),
}));
jest.mock('../../lib/search-discovery-parity', () => ({
  vendorRowIsOnline: (v: unknown) => v === true || v === 'true',
}));

import {
  slimDiscoveryListService,
  enrichDiscoveryListVendor,
  enrichDiscoveryListVendorsConcurrent,
} from '../discovery-list-enrich';

describe('slimDiscoveryListService', () => {
  it('keeps list fields and drops bulky metadata', () => {
    const slim = slimDiscoveryListService({
      id: 'vs-1',
      serviceId: 'svc-1',
      name: 'Bath',
      price: 499,
      duration: 45,
      category: 'grooming',
      serviceStyle: 'at_center',
      isPackage: true,
      metadata: { huge: 'blob', nested: { a: 1 } },
      packageDetails: { sessions: 5, price: 2000 },
      description: 'long text '.repeat(50),
      publishStatus: 'published',
      isEnabled: true,
    });
    expect(slim.id).toBe('vs-1');
    expect(slim.isPackage).toBe(true);
    expect(slim.price).toBe(499);
    expect(slim.metadata).toBeUndefined();
    expect(slim.packageDetails).toBeUndefined();
    expect(slim.description).toBeUndefined();
  });
});

describe('enrichDiscoveryListVendor', () => {
  it('returns card fields without services[] by default', async () => {
    const card = await enrichDiscoveryListVendor({
      vendor: {
        vendor_id: 'v1',
        business_name: 'Clinic',
        phone: '99',
        address: 'A',
        city: 'C',
        role_display_name: 'Vet',
        role_name: 'veterinarian',
        vendor_type: 'business',
        avg_rating: '4.5',
        review_count: '3',
        is_online: true,
      },
      services: [
        { id: 's1', name: 'Consult', price: 500 },
        { id: 's2', name: 'Follow-up', price: 300 },
      ],
      acceptableStyles: ['at_center'],
      distResolver: { resolve: async () => ({ km: 1.2, distanceText: '1.2 km' }) } as any,
      getNextAvailableSlot: async () => ({ display: 'Tomorrow 10:00 AM' }),
      defaultAvailabilityDisplay: 'Tap to view availability',
    });
    expect(card).not.toBeNull();
    expect(card!.services).toBeUndefined();
    expect(card!.photoUrl).toBeNull();
    expect(card!.priceMin).toBe(300);
    expect(card!.priceMax).toBe(500);
    expect(card!.serviceCount).toBe(2);
    expect(card!.photos).toBeUndefined();
    expect(card!.photo).toBeUndefined();
  });
});

describe('enrichDiscoveryListVendorsConcurrent', () => {
  it('dedupes vendor_id and filters nulls / soft-fails', async () => {
    const rows = [
      { vendor_id: 'a' },
      { vendor_id: 'a' },
      { vendor_id: 'b' },
      { vendor_id: 'c' },
    ];
    const calls: string[] = [];
    const out = await enrichDiscoveryListVendorsConcurrent(rows, async (row) => {
      calls.push(row.vendor_id);
      if (row.vendor_id === 'b') throw new Error('boom');
      if (row.vendor_id === 'c') return null;
      return { id: row.vendor_id, name: 'ok' };
    }, 2);
    expect(calls.sort()).toEqual(['a', 'b', 'c']);
    expect(out).toEqual([{ id: 'a', name: 'ok' }]);
  });
});
