import {
  vendorGalleryDrivesListingPhoto,
  getVendorListingPhotoUrl,
} from '../vendor-listing-photo';

jest.mock('../../endpoints/constants/helper', () => ({
  regeneratePresignedUrl: jest.fn(async (keyOrUrl: string | null | undefined) => {
    if (!keyOrUrl) return null;
    const s = String(keyOrUrl).trim();
    if (s.startsWith('https://')) return s;
    return `https://signed.example/${encodeURIComponent(s)}`;
  }),
}));

const { regeneratePresignedUrl } = jest.requireMock('../../endpoints/constants/helper') as {
  regeneratePresignedUrl: jest.Mock;
};

describe('vendorGalleryDrivesListingPhoto', () => {
  it('returns true for non-solo vendor types', () => {
    expect(vendorGalleryDrivesListingPhoto({ vendor_type: 'center' })).toBe(true);
    expect(vendorGalleryDrivesListingPhoto({ vendor_type: 'business' })).toBe(true);
  });

  it('returns false for solo', () => {
    expect(vendorGalleryDrivesListingPhoto({ vendor_type: 'solo' })).toBe(false);
  });
});

describe('getVendorListingPhotoUrl', () => {
  beforeEach(() => {
    regeneratePresignedUrl.mockClear();
  });

  it('uses first facility photo for center vendors', async () => {
    const url = await getVendorListingPhotoUrl({
      vendor_type: 'center',
      metadata: { facility_photos: ['vendors/abc/gallery1.jpg'] },
      profile_photo_url: 'vendors/abc/profile.jpg',
    });
    expect(url).toBe('https://signed.example/vendors%2Fabc%2Fgallery1.jpg');
    expect(regeneratePresignedUrl).toHaveBeenCalledWith('vendors/abc/gallery1.jpg');
  });

  it('uses profile_photo_url for solo when gallery exists', async () => {
    const url = await getVendorListingPhotoUrl({
      vendor_type: 'solo',
      metadata: { facility_photos: ['vendors/solo/g1.jpg'] },
      profile_photo_url: 'vendors/solo/profile.jpg',
    });
    expect(url).toBe('https://signed.example/vendors%2Fsolo%2Fprofile.jpg');
    expect(regeneratePresignedUrl).toHaveBeenCalledWith('vendors/solo/profile.jpg');
  });

  it('falls back to facility photo for solo when profile fields empty', async () => {
    const url = await getVendorListingPhotoUrl({
      vendor_type: 'solo',
      metadata: { facility_photos: ['vendors/solo/g1.jpg'] },
    });
    expect(url).toBe('https://signed.example/vendors%2Fsolo%2Fg1.jpg');
  });

  it('parses string metadata JSON', async () => {
    const url = await getVendorListingPhotoUrl({
      vendor_type: 'center',
      metadata: JSON.stringify({ facility_photos: ['vendors/x/1.jpg'] }),
    });
    expect(url).toContain('vendors%2Fx%2F1.jpg');
  });

  it('returns null when no photo sources', async () => {
    expect(await getVendorListingPhotoUrl({ vendor_type: 'solo' })).toBeNull();
  });
});
