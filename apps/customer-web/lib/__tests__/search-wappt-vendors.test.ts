jest.mock('@/lib/api-client', () => ({ apiClient: { get: jest.fn() } }));
jest.mock('@/lib/warmpawz-appointments-customer', () => ({
  isWarmpawzAppointmentsHubEnabled: jest.fn(() => false),
}));
jest.mock('@/lib/commerce-switch-routing/warmpawz-pay-feature', () => ({
  isWarmpawzPayModuleCapable: jest.fn(() => true),
}));

import { apiClient } from '@/lib/api-client';
import { isWarmpawzAppointmentsHubEnabled } from '@/lib/warmpawz-appointments-customer';
import { isWarmpawzPayModuleCapable } from '@/lib/commerce-switch-routing/warmpawz-pay-feature';
import {
  canLoadWapptSearchHub,
  resolveWapptHubsForSearch,
  fetchWapptSearchVendorResults,
  mergeWapptSearchVendorRows,
} from '../search-wappt-vendors';

describe('canLoadWapptSearchHub', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (isWarmpawzAppointmentsHubEnabled as jest.Mock).mockReturnValue(false);
    (isWarmpawzPayModuleCapable as jest.Mock).mockReturnValue(true);
  });

  it('loads known hubs when Pay module is capable even if commerce hub is off', () => {
    expect(canLoadWapptSearchHub('grooming')).toBe(true);
    expect(canLoadWapptSearchHub('vet')).toBe(true);
  });

  it('returns false when Pay module is disabled and appointments hub is off', () => {
    (isWarmpawzPayModuleCapable as jest.Mock).mockReturnValue(false);
    expect(canLoadWapptSearchHub('grooming')).toBe(false);
  });

  it('returns true when appointments hub is enabled', () => {
    (isWarmpawzPayModuleCapable as jest.Mock).mockReturnValue(false);
    (isWarmpawzAppointmentsHubEnabled as jest.Mock).mockReturnValue(true);
    expect(canLoadWapptSearchHub('grooming')).toBe(true);
  });
});

describe('resolveWapptHubsForSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (isWarmpawzAppointmentsHubEnabled as jest.Mock).mockReturnValue(false);
    (isWarmpawzPayModuleCapable as jest.Mock).mockReturnValue(true);
  });

  it('returns hub when WAPPT listing is eligible for category chip', () => {
    expect(resolveWapptHubsForSearch({ category: 'vet' })).toEqual(['vet']);
  });

  it('infers grooming from keyword', () => {
    expect(resolveWapptHubsForSearch({ query: 'dog grooming salon' })).toEqual(['grooming']);
  });

  it('returns parity hubs on browse-all', () => {
    expect(resolveWapptHubsForSearch({ browseAll: true }).sort()).toEqual([
      'boarding',
      'grooming',
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
    (isWarmpawzAppointmentsHubEnabled as jest.Mock).mockReturnValue(false);
    (isWarmpawzPayModuleCapable as jest.Mock).mockReturnValue(true);
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
