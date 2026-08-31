import {
  normalizeProviderListPhoto,
  pickVendorPhotoFromRow,
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
  it('returns undefined for bare S3 keys', () => {
    expect(
      pickVendorPhotoFromRow({ photoUrl: 'vendors/abc/facility.jpeg' })
    ).toBeUndefined();
  });
});

describe('normalizeProviderListPhoto bare keys', () => {
  it('does not fall through to a bare S3 key as img src', () => {
    expect(
      normalizeProviderListPhoto({
        profile_photo_url: 'vendors/abc/facility.jpeg',
        photo: 'media/vendor/abc/x.webp',
      })
    ).toBeUndefined();
  });
});
