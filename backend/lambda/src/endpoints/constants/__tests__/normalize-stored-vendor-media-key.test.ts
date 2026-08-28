import { normalizeStoredVendorMediaKey } from '../helper';

describe('normalizeStoredVendorMediaKey', () => {
  it('keeps managed bare keys', () => {
    expect(normalizeStoredVendorMediaKey('vendors/abc/facility/a.jpg')).toBe(
      'vendors/abc/facility/a.jpg'
    );
    expect(normalizeStoredVendorMediaKey('media/vendor/abc/facility/x.webp')).toBe(
      'media/vendor/abc/facility/x.webp'
    );
    expect(normalizeStoredVendorMediaKey('media/staff/abc/p.webp')).toBe('media/staff/abc/p.webp');
  });

  it('extracts key from virtual-hosted S3 URL including expired query', () => {
    const url =
      'https://warmpawz-dev-uploads.s3.ap-south-1.amazonaws.com/media/vendor/abc/facility/x.webp?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=x';
    expect(normalizeStoredVendorMediaKey(url)).toBe('media/vendor/abc/facility/x.webp');
  });

  it('rejects garbage and empty values', () => {
    expect(normalizeStoredVendorMediaKey('')).toBeNull();
    expect(normalizeStoredVendorMediaKey('not-a-key')).toBeNull();
    expect(normalizeStoredVendorMediaKey('https://cdn.example/photo.jpg')).toBeNull();
  });
});
