jest.mock('../../../utils/s3-media-presign', () => ({
  presignS3GetUrlIfApplicable: jest.fn(async (url: string) => {
    if (url.includes('warmpawz-dev-uploads')) {
      return 'https://signed.example/presigned-from-host-bucket.jpg';
    }
    return url;
  }),
}));

jest.mock('../image-migrator', () => ({
  ensureWebpFromLegacy: jest.fn(),
  extractRawImageKey: jest.requireActual('../image-migrator').extractRawImageKey,
}));

jest.mock('../image-url-builder', () => ({
  attachUrlsToImageDto: jest.fn(async (dto: { imageKey: string; thumbKey: string | null }) => ({
    ...dto,
    url: `https://cdn.example/${dto.imageKey}`,
    thumbUrl: dto.thumbKey ? `https://cdn.example/${dto.thumbKey}` : null,
  })),
  urlForImageKey: jest.fn(async (key: string | null | undefined) =>
    key ? `https://cdn.example/${key}` : null,
  ),
}));

import { resolveImageForContext } from '../image-resolve';
import { ensureWebpFromLegacy } from '../image-migrator';

describe('resolveImageForContext', () => {
  it('uses full url for list context on WebP keys without a known thumb', async () => {
    const resolved = await resolveImageForContext('products/vendor1/abc.webp', {
      assetType: 'product',
      ownerId: 'vendor1',
      vendorId: 'vendor1',
      context: 'list',
      migrate: false,
    });
    expect(resolved).not.toBeNull();
    expect(resolved!.displayUrl).toBe(resolved!.url);
    expect(resolved!.displayUrl).toContain('abc.webp');
    expect(resolved!.displayUrl).not.toContain('.thumb.');
    expect(resolved!.thumbUrl).toBeNull();
  });

  it('uses migrated thumb for list context when migrate provides one', async () => {
    (ensureWebpFromLegacy as jest.Mock).mockResolvedValueOnce({
      imageKey: 'media/vendor/v1/facility/x.webp',
      url: 'https://cdn.example/media/vendor/v1/facility/x.webp',
      thumbUrl: 'https://cdn.example/media/vendor/v1/facility/x.thumb.webp',
      thumbKey: 'media/vendor/v1/facility/x.thumb.webp',
      width: 0,
      height: 0,
      thumbWidth: null,
      thumbHeight: null,
      size: 0,
      thumbSize: null,
      contentType: 'image/webp',
    });
    const resolved = await resolveImageForContext('vendors/v1/facility/old.jpg', {
      assetType: 'facility',
      ownerId: 'v1',
      vendorId: 'v1',
      context: 'list',
      migrate: true,
    });
    expect(resolved!.displayUrl).toContain('.thumb.webp');
    expect(resolved!.url).toContain('x.webp');
  });

  it('returns full url for detail context', async () => {
    const resolved = await resolveImageForContext('products/vendor1/abc.webp', {
      assetType: 'product',
      ownerId: 'vendor1',
      vendorId: 'vendor1',
      context: 'detail',
      migrate: false,
    });
    expect(resolved!.displayUrl).toBe(resolved!.url);
    expect(resolved!.displayUrl).not.toContain('.thumb.');
  });

  it('returns full jpeg url for list context on legacy non-WebP keys', async () => {
    const legacyKey = 'vendors/vendor1/facility/facility_123.jpeg';
    const resolved = await resolveImageForContext(legacyKey, {
      assetType: 'facility',
      ownerId: 'vendor1',
      vendorId: 'vendor1',
      context: 'list',
      migrate: false,
    });
    expect(resolved).not.toBeNull();
    expect(resolved!.displayUrl).toContain('facility_123.jpeg');
    expect(resolved!.displayUrl).not.toContain('.thumb.webp');
    expect(resolved!.thumbUrl).toBeNull();
  });

  it('presigns managed S3 HTTPS URLs using host bucket when migrate is false', async () => {
    const hosted =
      'https://warmpawz-dev-uploads.s3.ap-south-1.amazonaws.com/vendors/vendor1/profile/photo.jpg';
    const resolved = await resolveImageForContext(hosted, {
      assetType: 'profile',
      ownerId: 'vendor1',
      vendorId: 'vendor1',
      context: 'list',
      migrate: false,
    });
    expect(resolved).not.toBeNull();
    expect(resolved!.displayUrl).toBe('https://signed.example/presigned-from-host-bucket.jpg');
    expect(resolved!.displayUrl).not.toContain('user-uploads-057442119249');
  });
});
