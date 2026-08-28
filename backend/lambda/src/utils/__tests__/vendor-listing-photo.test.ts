import {
  vendorGalleryDrivesListingPhoto,
  getVendorListingPhotoUrl,
} from '../vendor-listing-photo';

jest.mock('../../services/image', () => ({
  resolveImageForContext: jest.fn(async (raw: string, opts: { context?: string; assetType?: string }) => {
    const s = String(raw).trim();
    if (!s) return null;
    return {
      displayUrl: `https://resolved.example/${opts.context ?? 'list'}/${opts.assetType ?? 'profile'}/${encodeURIComponent(s)}`,
      imageKey: s,
      url: `https://resolved.example/full/${encodeURIComponent(s)}`,
      thumbUrl: `https://resolved.example/thumb/${encodeURIComponent(s)}`,
      width: 0,
      height: 0,
      thumbWidth: null,
      thumbHeight: null,
    };
  }),
}));

jest.mock('../../endpoints/constants/helper', () => ({
  regeneratePresignedUrl: jest.fn(async (keyOrUrl: string | null | undefined) => {
    if (!keyOrUrl) return null;
    const s = String(keyOrUrl).trim();
    if (s.startsWith('https://')) return s;
    return `https://signed.example/${encodeURIComponent(s)}`;
  }),
}));

const { resolveImageForContext } = jest.requireMock('../../services/image') as {
  resolveImageForContext: jest.Mock;
};

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
    resolveImageForContext.mockClear();
    regeneratePresignedUrl.mockClear();
  });

  it('uses resolveImageForContext list thumbs for center facility photo', async () => {
    const url = await getVendorListingPhotoUrl({
      id: 'vendor-abc',
      vendor_type: 'center',
      metadata: { facility_photos: ['vendors/abc/gallery1.webp'] },
      profile_photo_url: 'vendors/abc/profile.webp',
    });
    expect(url).toBe(
      'https://resolved.example/list/facility/vendors%2Fabc%2Fgallery1.webp',
    );
    expect(resolveImageForContext).toHaveBeenCalledWith(
      'vendors/abc/gallery1.webp',
      expect.objectContaining({ context: 'list', assetType: 'facility', vendorId: 'vendor-abc', migrate: false }),
    );
  });

  it('uses profile asset type for solo when profile present', async () => {
    const url = await getVendorListingPhotoUrl({
      id: 'solo-1',
      vendor_type: 'solo',
      metadata: { facility_photos: ['vendors/solo/g1.webp'] },
      profile_photo_url: 'vendors/solo/profile.webp',
    });
    expect(url).toContain('list/profile');
    expect(resolveImageForContext).toHaveBeenCalledWith(
      'vendors/solo/profile.webp',
      expect.objectContaining({ assetType: 'profile' }),
    );
  });

  it('falls back to facility photo for solo when profile fields empty', async () => {
    const url = await getVendorListingPhotoUrl({
      id: 'solo-2',
      vendor_type: 'solo',
      metadata: { facility_photos: ['vendors/solo/g1.webp'] },
    });
    expect(url).toContain('list/facility');
  });

  it('parses string metadata JSON', async () => {
    const url = await getVendorListingPhotoUrl({
      id: 'v-x',
      vendor_type: 'center',
      metadata: JSON.stringify({ facility_photos: ['vendors/x/1.webp'] }),
    });
    expect(url).toContain('vendors%2Fx%2F1.webp');
  });

  it('falls back to regeneratePresignedUrl when vendor id missing', async () => {
    const url = await getVendorListingPhotoUrl({
      vendor_type: 'center',
      metadata: { facility_photos: ['vendors/x/1.jpg'] },
    });
    expect(url).toBe('https://signed.example/vendors%2Fx%2F1.jpg');
    expect(regeneratePresignedUrl).toHaveBeenCalled();
    expect(resolveImageForContext).not.toHaveBeenCalled();
  });

  it('prefers resolveImageForContext displayUrl over regeneratePresignedUrl', async () => {
    regeneratePresignedUrl.mockResolvedValueOnce('https://signed.example/legacy.jpg');
    const url = await getVendorListingPhotoUrl({
      id: 'solo-legacy',
      vendor_type: 'solo',
      profile_photo_url: 'vendors/solo-legacy/profile/photo.jpg',
    });
    expect(url).toBe(
      'https://resolved.example/list/profile/vendors%2Fsolo-legacy%2Fprofile%2Fphoto.jpg'
    );
    expect(regeneratePresignedUrl).not.toHaveBeenCalled();
  });

  it('returns null when no photo sources', async () => {
    expect(await getVendorListingPhotoUrl({ vendor_type: 'solo' })).toBeNull();
  });
});
