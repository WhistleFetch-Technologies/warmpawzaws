import {
  normalizeProviderListPhoto,
  pickVendorPhotoFromRow,
  sanitizeDisplayImageUrl,
} from '../resolve-display-image-url';

describe('normalizeProviderListPhoto', () => {
  it('returns photoUrl when photo is absent', () => {
    const url = 'https://cdn.example/media/vendor/abc.thumb.webp';
    expect(
      normalizeProviderListPhoto({ photoUrl: url })
    ).toBe(url);
  });

  it('prefers profile_photo_url over photoUrl per pickVendorPhotoFromRow order', () => {
    const profile = 'https://cdn.example/profile.webp';
    const list = 'https://cdn.example/list.thumb.webp';
    expect(
      normalizeProviderListPhoto({
        profile_photo_url: profile,
        photoUrl: list,
      })
    ).toBe(profile);
  });

  it('falls back to resolveVendorProfilePhotoUrl nested fields', () => {
    expect(
      normalizeProviderListPhoto({
        vendorProfileImage: 'https://cdn.example/vendor.jpg',
      })
    ).toBe('https://cdn.example/vendor.jpg');
  });

  it('covers nutrition discovery rows that only expose photoUrl', () => {
    const url = 'https://cdn.example/nutrition.thumb.webp';
    expect(
      normalizeProviderListPhoto({
        id: 'v1',
        name: 'Whisker Wise',
        photoUrl: url,
      })
    ).toBe(url);
  });
});

describe('pickVendorPhotoFromRow', () => {
  it('keeps managed S3 keys for CachedImage to sign', () => {
    expect(pickVendorPhotoFromRow({ photoUrl: 'vendors/abc/facility.jpeg' })).toBe(
      'vendors/abc/facility.jpeg',
    );
  });

  it('drops junk that is not a url or managed key', () => {
    expect(pickVendorPhotoFromRow({ photoUrl: 'not-a-photo' })).toBeUndefined();
    expect(pickVendorPhotoFromRow({ photoUrl: 'null' })).toBeUndefined();
  });
});

describe('sanitizeDisplayImageUrl', () => {
  it('keeps managed keys for the signer path and drops junk', () => {
    expect(sanitizeDisplayImageUrl('vendors/foo/profile.jpg')).toBe('vendors/foo/profile.jpg');
    expect(sanitizeDisplayImageUrl('https://cdn.example/ok.webp')).toBe('https://cdn.example/ok.webp');
    expect(sanitizeDisplayImageUrl(null)).toBeUndefined();
    expect(sanitizeDisplayImageUrl('null')).toBeUndefined();
    expect(sanitizeDisplayImageUrl('plain text')).toBeUndefined();
  });
});

describe('normalizeProviderListPhoto managed keys', () => {
  it('prefers profile_photo_url even when it is a managed key', () => {
    expect(
      normalizeProviderListPhoto({
        profile_photo_url: 'vendors/abc/facility.jpeg',
        photo: 'media/vendor/abc/x.webp',
      })
    ).toBe('vendors/abc/facility.jpeg');
  });
});
