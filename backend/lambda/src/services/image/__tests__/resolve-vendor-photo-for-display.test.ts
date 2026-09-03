jest.mock('../image-resolve', () => ({
  resolveImageForContext: jest.fn(),
}));

jest.mock('../../../utils/s3-media-presign', () => ({
  presignS3GetUrlIfApplicable: jest.fn(async (url: string) =>
    /^https?:\/\//i.test(url) ? url : null,
  ),
  stripS3PresignQueryFromUrl: jest.fn((url: string) => url),
}));

jest.mock('../../../endpoints/constants/helper', () => ({
  regeneratePresignedUrl: jest.fn(),
}));

import { resolveImageForContext } from '../image-resolve';
import { regeneratePresignedUrl } from '../../../endpoints/constants/helper';
import { resolveVendorPhotoForDisplay } from '../resolve-entity-profile-photo';

const mockResolve = resolveImageForContext as jest.MockedFunction<typeof resolveImageForContext>;
const mockRegen = regeneratePresignedUrl as jest.MockedFunction<typeof regeneratePresignedUrl>;

describe('resolveVendorPhotoForDisplay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRegen.mockResolvedValue(null);
  });

  it('returns https displayUrl from ImageService and persists vendors.profile_photo_url', async () => {
    mockResolve.mockResolvedValue({
      imageKey: 'media/vendor/v1/avatar_abc.webp',
      url: 'https://cdn.example/media/vendor/v1/avatar_abc.webp',
      thumbUrl: null,
      displayUrl: 'https://cdn.example/media/vendor/v1/avatar_abc.webp',
      width: 0,
      height: 0,
      thumbWidth: null,
      thumbHeight: null,
    });

    const out = await resolveVendorPhotoForDisplay('media/vendor/v1/avatar_abc.webp', 'vendor-1');
    expect(out).toBe('https://cdn.example/media/vendor/v1/avatar_abc.webp');
    expect(mockResolve).toHaveBeenCalledWith(
      'media/vendor/v1/avatar_abc.webp',
      expect.objectContaining({
        assetType: 'profile',
        ownerId: 'vendor-1',
        vendorId: 'vendor-1',
        context: 'detail',
        persist: {
          kind: 'scalar',
          table: 'vendors',
          column: 'profile_photo_url',
          idColumn: 'id',
          id: 'vendor-1',
        },
      }),
    );
  });

  it('falls back to helper regeneratePresignedUrl when resolve has no https url', async () => {
    mockResolve.mockResolvedValue({
      imageKey: 'vendors/v1/photo.jpg',
      url: 'vendors/v1/photo.jpg',
      thumbUrl: null,
      displayUrl: 'vendors/v1/photo.jpg',
      width: 0,
      height: 0,
      thumbWidth: null,
      thumbHeight: null,
    });
    mockRegen.mockResolvedValue('https://signed.example/vendors/v1/photo.jpg');

    const out = await resolveVendorPhotoForDisplay('vendors/v1/photo.jpg', 'vendor-1');
    expect(out).toBe('https://signed.example/vendors/v1/photo.jpg');
    expect(mockRegen).toHaveBeenCalled();
  });

  it('returns null for garbage and never returns a bare key', async () => {
    mockResolve.mockResolvedValue(null);
    mockRegen.mockResolvedValue(null);

    expect(await resolveVendorPhotoForDisplay('', 'vendor-1')).toBeNull();
    expect(await resolveVendorPhotoForDisplay('null', 'vendor-1')).toBeNull();
    expect(await resolveVendorPhotoForDisplay('media/vendor/v1/avatar.webp', 'vendor-1')).toBeNull();
    expect(await resolveVendorPhotoForDisplay('vendors/solo/profile/photo.jpg', 'vendor-1')).toBeNull();
  });

  it('passes through an already-https URL from resolve', async () => {
    mockResolve.mockResolvedValue({
      imageKey: 'https://cdn.example/ok.jpg',
      url: 'https://cdn.example/ok.jpg',
      thumbUrl: null,
      displayUrl: 'https://cdn.example/ok.jpg',
      width: 0,
      height: 0,
      thumbWidth: null,
      thumbHeight: null,
    });
    const out = await resolveVendorPhotoForDisplay('https://cdn.example/ok.jpg', 'vendor-1');
    expect(out).toBe('https://cdn.example/ok.jpg');
  });
});
