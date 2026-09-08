import {
  getVendorDisplayStatus,
  getVendorDisplayStatusLabel,
  isRemovedFromCatalog,
} from '../vendor-product-display-status';

describe('getVendorDisplayStatus', () => {
  it('shows pending for awaiting approval', () => {
    expect(getVendorDisplayStatus({ status: 'pending', is_active: false })).toBe('pending');
  });

  it('shows uploading photos while images copy to S3', () => {
    expect(
      getVendorDisplayStatus({
        status: 'pending',
        is_active: false,
        image_ingest_status: 'processing',
        approval_hold: 'images',
      }),
    ).toBe('photos_uploading');
    expect(
      getVendorDisplayStatus({
        status: 'pending',
        is_active: false,
        approval_hold: 'images',
      }),
    ).toBe('photos_uploading');
  });

  it('shows photos retrying after a failed ingest', () => {
    expect(
      getVendorDisplayStatus({
        status: 'pending',
        is_active: false,
        image_ingest_status: 'failed',
        approval_hold: 'images',
      }),
    ).toBe('photos_retrying');
  });

  it('shows pending after the image hold clears', () => {
    expect(
      getVendorDisplayStatus({
        status: 'pending',
        is_active: false,
        image_ingest_status: 'ready',
      }),
    ).toBe('pending');
  });

  it('labels uploading and retrying distinctly from pending approval', () => {
    expect(getVendorDisplayStatusLabel('photos_uploading')).toBe('Uploading photos');
    expect(getVendorDisplayStatusLabel('photos_retrying')).toBe('Photos retrying');
    expect(getVendorDisplayStatusLabel('pending')).toBe('Pending approval');
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
