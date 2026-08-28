import {
  resolveCustomerVendorAmenities,
  resolveVendorProfileHeroGallery,
  resolveVendorProfilePhotoUrl,
  shouldShowVendorAmenities,
} from '../vendor-display-media';

describe('resolveCustomerVendorAmenities', () => {
  it('reads amenities and customAmenities from facility-shaped payload', () => {
    const resolved = resolveCustomerVendorAmenities({
      amenities: ['parking', 'wifi'],
      customAmenities: ['Suite Room'],
    });
    expect(resolved.amenities).toEqual(['parking', 'wifi']);
    expect(resolved.customAmenities).toEqual(['Suite Room']);
  });

  it('accepts snake_case custom_amenities', () => {
    const resolved = resolveCustomerVendorAmenities({
      amenities: ['ac'],
      custom_amenities: ['Cat ward'],
    });
    expect(resolved.customAmenities).toEqual(['Cat ward']);
  });

  it('returns empty arrays when missing', () => {
    expect(resolveCustomerVendorAmenities(null)).toEqual({
      amenities: [],
      customAmenities: [],
    });
  });
});

describe('shouldShowVendorAmenities', () => {
  it('returns false for tele', () => {
    expect(shouldShowVendorAmenities('tele')).toBe(false);
    expect(shouldShowVendorAmenities('TELE')).toBe(false);
  });

  it('returns true for in-person styles and when unset', () => {
    expect(shouldShowVendorAmenities('at_center')).toBe(true);
    expect(shouldShowVendorAmenities('at_home')).toBe(true);
    expect(shouldShowVendorAmenities(undefined)).toBe(true);
    expect(shouldShowVendorAmenities(null)).toBe(true);
  });
});

describe('vendor photo URL sanitization', () => {
  it('drops bare S3 keys from profile photo', () => {
    expect(resolveVendorProfilePhotoUrl({ profile_photo_url: 'vendors/foo/profile.jpg' })).toBeUndefined();
    expect(
      resolveVendorProfilePhotoUrl({ photoUrl: 'https://cdn.example/ok.webp' })
    ).toBe('https://cdn.example/ok.webp');
  });

  it('hero gallery ignores empty photos arrays and bare keys, uses facilityPhotos', () => {
    const urls = resolveVendorProfileHeroGallery({
      facility: { photos: [] },
      vendor: {
        photos: [],
        gallery: [],
        facilityPhotos: ['https://signed.example/clinic.webp'],
        photoUrl: 'vendors/x/legacy.jpg',
      },
    });
    expect(urls).toEqual(['https://signed.example/clinic.webp']);
  });
});
