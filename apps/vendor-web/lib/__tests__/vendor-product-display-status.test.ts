import {
  getVendorDisplayStatus,
  isRemovedFromCatalog,
} from '../vendor-product-display-status';

describe('getVendorDisplayStatus', () => {
  it('shows pending for awaiting approval', () => {
    expect(getVendorDisplayStatus({ status: 'pending', is_active: false })).toBe('pending');
  });

  it('shows active for live products', () => {
    expect(getVendorDisplayStatus({ status: 'active', is_active: true })).toBe('active');
  });

  it('shows removed (not pending) for soft-deleted live products', () => {
    expect(getVendorDisplayStatus({ status: 'active', is_active: false })).toBe('inactive');
    expect(getVendorDisplayStatus({ status: 'inactive', is_active: false })).toBe('inactive');
  });

  it('identifies removed catalog items', () => {
    expect(isRemovedFromCatalog({ status: 'inactive', is_active: false })).toBe(true);
    expect(isRemovedFromCatalog({ status: 'pending', is_active: false })).toBe(false);
  });
});
