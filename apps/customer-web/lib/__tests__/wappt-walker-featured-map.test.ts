import {
  shouldLoadWalkerMarketplaceDiscovery,
  wapptFeaturedVendorToWalkerRow,
} from '../wappt-walker-featured-map';
import type { BoardingListVendor } from '../boarding-vendor-discovery-map';

function featuredVendor(overrides: Partial<BoardingListVendor> = {}): BoardingListVendor {
  return {
    id: 'walker-published-1',
    name: 'Published Walker',
    address: 'Koramangala',
    rating: 4.6,
    review_count: 8,
    distance: null,
    distanceKm: null,
    timing: '',
    services: [],
    price_label: '',
    isVerified: true,
    photo: 'https://cdn.example/walker.jpg',
    planRows: [],
    needsServiceFetch: false,
    raw: {
      vendorId: 'walker-published-1',
      city: 'Bengaluru',
      roleName: 'walker',
    },
    ...overrides,
  };
}

describe('shouldLoadWalkerMarketplaceDiscovery', () => {
  it('is off when Warmpawz Pay walker hub is on', () => {
    expect(shouldLoadWalkerMarketplaceDiscovery(true)).toBe(false);
  });

  it('stays on for marketplace walker', () => {
    expect(shouldLoadWalkerMarketplaceDiscovery(false)).toBe(true);
  });
});

describe('wapptFeaturedVendorToWalkerRow', () => {
  it('stamps published catalogue identity for Available Walkers cards', () => {
    const row = wapptFeaturedVendorToWalkerRow(featuredVendor());
    expect(row.vendorId).toBe('walker-published-1');
    expect(row.name).toBe('Published Walker');
    expect(row.warmpawzAppointments).toBe(true);
    expect(row.appointmentsMode).toBe(true);
    expect(row.city).toBe('Bengaluru');
  });

  it('uses catalogue vendor id when raw id is missing', () => {
    const row = wapptFeaturedVendorToWalkerRow(
      featuredVendor({ raw: { city: 'Pune' } }),
    );
    expect(row.vendorId).toBe('walker-published-1');
    expect(row.vendor_id).toBe('walker-published-1');
  });
});

describe('walker featured feed contract', () => {
  it('uses WAPPT by-category, not marketplace discover-services', () => {
    const qs = new URLSearchParams({
      category: 'walker',
      serviceStyle: 'all',
      limit: '3',
    });
    const url = `/customer/warmpawz-appointments/discovery/by-category?${qs}`;
    expect(url).toContain('category=walker');
    expect(url).not.toContain('discover-services');
    expect(url).not.toContain('vendors/search');
  });
});
