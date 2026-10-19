import {
  ACTIVE_VENDOR_PAGE_SIZE,
  activeVendorLabel,
  activeVendorRole,
  fetchAllActiveVendors,
  filterActiveVendors,
  type ActiveVendorHit,
} from '../vendor-active-list';

const vendor = (id: string, name: string, role = ''): ActiveVendorHit => ({
  id,
  businessName: name,
  roleDisplayName: role,
});

describe('active vendor labels', () => {
  it('reads camelCase names and roles from the active vendors API', () => {
    const v = vendor('v1', 'Aanand K9 Training', 'Trainer');
    expect(activeVendorLabel(v)).toBe('Aanand K9 Training');
    expect(activeVendorRole(v)).toBe('Trainer');
  });
});

describe('filterActiveVendors', () => {
  const rows = [
    vendor('b', 'Beta Clinic', 'Vet'),
    vendor('a', 'Aanand K9 Training', 'Trainer'),
  ];

  it('returns every vendor, A to Z, when the box is empty', () => {
    expect(filterActiveVendors(rows, '').map((v) => v.id)).toEqual(['a', 'b']);
    expect(filterActiveVendors(rows, '   ').map((v) => v.id)).toEqual(['a', 'b']);
  });

  it('filters the full active list by name or role', () => {
    expect(filterActiveVendors(rows, 'k9').map((v) => v.id)).toEqual(['a']);
    expect(filterActiveVendors(rows, 'vet').map((v) => v.id)).toEqual(['b']);
  });
});

describe('fetchAllActiveVendors', () => {
  it('follows offset until every active vendor is loaded', async () => {
    const first = Array.from({ length: ACTIVE_VENDOR_PAGE_SIZE }, (_, i) =>
      vendor(String(i), `Vendor ${i}`),
    );
    const pages = [
      { vendors: first, total: ACTIVE_VENDOR_PAGE_SIZE + 1 },
      { vendors: [vendor('last', 'Last Clinic')], total: ACTIVE_VENDOR_PAGE_SIZE + 1 },
    ];
    const urls: string[] = [];
    const all = await fetchAllActiveVendors(async (url) => {
      urls.push(url);
      return pages[urls.length - 1];
    });
    expect(urls).toEqual([
      `/admin/vendors/active?limit=${ACTIVE_VENDOR_PAGE_SIZE}&offset=0`,
      `/admin/vendors/active?limit=${ACTIVE_VENDOR_PAGE_SIZE}&offset=${ACTIVE_VENDOR_PAGE_SIZE}`,
    ]);
    expect(all).toHaveLength(ACTIVE_VENDOR_PAGE_SIZE + 1);
    expect(all[all.length - 1].id).toBe('last');
  });
});
