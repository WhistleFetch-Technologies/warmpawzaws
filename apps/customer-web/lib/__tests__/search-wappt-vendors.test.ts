jest.mock('@/lib/api-client', () => ({ apiClient: { get: jest.fn() } }));
jest.mock('@/lib/warmpawz-appointments-customer', () => ({
  isWarmpawzAppointmentsHubEnabled: jest.fn(() => false),
}));

import { apiClient } from '@/lib/api-client';
import { isWarmpawzAppointmentsHubEnabled } from '@/lib/warmpawz-appointments-customer';
import {
  canLoadWapptSearchHub,
  resolveWapptHubsForSearch,
  fetchWapptSearchVendorResults,
  mergeWapptSearchVendorRows,
  SEARCH_WAPPT_PARITY_HUBS,
} from '../search-wappt-vendors';

describe('canLoadWapptSearchHub', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (isWarmpawzAppointmentsHubEnabled as jest.Mock).mockReturnValue(false);
  });

  it('returns false when appointments hub is off (marketplace)', () => {
    expect(canLoadWapptSearchHub('grooming')).toBe(false);
    expect(canLoadWapptSearchHub('vet')).toBe(false);
  });

  it('returns true when appointments hub is enabled (warmpawz_pay)', () => {
    (isWarmpawzAppointmentsHubEnabled as jest.Mock).mockReturnValue(true);
    expect(canLoadWapptSearchHub('grooming')).toBe(true);
  });

  it('includes all 8 parity hub categories', () => {
    expect(SEARCH_WAPPT_PARITY_HUBS).toEqual(
      expect.arrayContaining(['behaviorist', 'nutrition', 'vet', 'grooming'])
    );
    expect(SEARCH_WAPPT_PARITY_HUBS).toHaveLength(8);
  });
});

describe('resolveWapptHubsForSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (isWarmpawzAppointmentsHubEnabled as jest.Mock).mockReturnValue(false);
  });

  it('returns empty when marketplace and category chip selected', () => {
    expect(resolveWapptHubsForSearch({ category: 'vet' })).toEqual([]);
  });

  it('returns hub when WAPPT listing is eligible for category chip', () => {
    (isWarmpawzAppointmentsHubEnabled as jest.Mock).mockReturnValue(true);
    expect(resolveWapptHubsForSearch({ category: 'vet' })).toEqual(['vet']);
  });

  it('infers grooming from keyword when pay is active', () => {
    (isWarmpawzAppointmentsHubEnabled as jest.Mock).mockImplementation(
      (hub: string) => hub === 'grooming'
    );
    expect(resolveWapptHubsForSearch({ query: 'dog grooming salon' })).toEqual(['grooming']);
  });

  it('returns parity hubs on browse-all only when pay is active', () => {
    expect(resolveWapptHubsForSearch({ browseAll: true })).toEqual([]);
    (isWarmpawzAppointmentsHubEnabled as jest.Mock).mockReturnValue(true);
    expect(resolveWapptHubsForSearch({ browseAll: true }).sort()).toEqual([
      'behaviorist',
      'boarding',
      'grooming',
      'nutrition',
      'sitting',
      'training',
      'vet',
      'walker',
    ]);
  });
});

describe('fetchWapptSearchVendorResults', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (isWarmpawzAppointmentsHubEnabled as jest.Mock).mockReturnValue(true);
  });

  it('returns empty when marketplace', async () => {
    (isWarmpawzAppointmentsHubEnabled as jest.Mock).mockReturnValue(false);
    const rows = await fetchWapptSearchVendorResults('vet');
    expect(rows).toEqual([]);
    expect(apiClient.get).not.toHaveBeenCalled();
  });

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
