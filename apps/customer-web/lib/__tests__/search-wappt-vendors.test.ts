jest.mock('@/lib/api-client', () => ({ apiClient: { get: jest.fn() } }));
jest.mock('@/lib/warmpawz-appointments-customer', () => ({
  isWarmpawzAppointmentsHubEnabled: jest.fn((hub: string) =>
    ['vet', 'grooming', 'training'].includes(hub)
  ),
}));

import { apiClient } from '@/lib/api-client';
import {
  resolveWapptHubsForSearch,
  fetchWapptSearchVendorResults,
  mergeWapptSearchVendorRows,
} from '../search-wappt-vendors';

describe('resolveWapptHubsForSearch', () => {
  it('returns hub when WAPPT enabled for category chip', () => {
    expect(resolveWapptHubsForSearch({ category: 'vet' })).toEqual(['vet']);
  });

  it('infers grooming from keyword', () => {
    expect(resolveWapptHubsForSearch({ query: 'dog grooming salon' })).toEqual(['grooming']);
  });

  it('returns parity hubs on browse-all', () => {
    expect(resolveWapptHubsForSearch({ browseAll: true }).sort()).toEqual([
      'grooming',
      'training',
      'vet',
    ]);
  });
});

describe('fetchWapptSearchVendorResults', () => {
  it('maps WAPPT discovery vendors', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      vendors: [
        {
          vendorId: 'v-1',
          name: 'City Vet',
          city: 'Bengaluru',
          shortAddress: 'Church Street',
          rating: 4.5,
          reviewCount: 12,
        },
      ],
      nextCursor: null,
    });

    const rows = await fetchWapptSearchVendorResults('vet');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 'v-1',
      name: 'City Vet',
      category: 'vet',
      city: 'Bengaluru',
    });
  });
});

describe('mergeWapptSearchVendorRows', () => {
  it('prepends WAPPT vendors not already in marketplace list', () => {
    const merged = mergeWapptSearchVendorRows(
      [{ id: 'a', type: 'vendor' as const, name: 'Existing' }],
      [
        {
          id: 'b',
          name: 'Wappt Vet',
          category: 'vet',
          rating: 0,
          reviewCount: 0,
          city: '',
          addressDisplay: '',
          distanceKm: null,
        },
      ],
      (w) => ({ id: w.id, type: 'vendor' as const, name: w.name })
    );
    expect(merged.map((r) => r.id)).toEqual(['b', 'a']);
  });
});
