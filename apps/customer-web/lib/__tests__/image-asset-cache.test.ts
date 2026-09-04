import {
  cacheKeyForImageSrc,
  extractS3ImageKey,
  isIndexedDbCacheableImageSrc,
  isManagedVendorMediaKey,
  isRefreshableManagedImageSrc,
  isStaticLocalImageSrc,
} from '../image-asset-cache';

describe('image-asset-cache keys', () => {
  it('classifies same-origin static paths', () => {
    expect(isStaticLocalImageSrc('/images/home/vet.webp')).toBe(true);
    expect(isStaticLocalImageSrc('/logo.webp')).toBe(true);
    expect(isStaticLocalImageSrc('https://bucket.s3.ap-south-1.amazonaws.com/k.webp')).toBe(
      false
    );
  });

  it('builds static cache keys from pathname', () => {
    expect(cacheKeyForImageSrc('/images/home/vet.webp')).toBe('static:/images/home/vet.webp');
    expect(cacheKeyForImageSrc('/images/home/vet.webp?v=1')).toBe('static:/images/home/vet.webp');
  });

  it('builds s3 cache keys from presigned URLs (stable across signatures)', () => {
    const url =
      'https://warmpawz-prod-user-uploads.s3.ap-south-1.amazonaws.com/products/v1/abc.thumb.webp?X-Amz-Signature=foo';
    const url2 =
      'https://warmpawz-prod-user-uploads.s3.ap-south-1.amazonaws.com/products/v1/abc.thumb.webp?X-Amz-Signature=bar';
    expect(cacheKeyForImageSrc(url)).toBe('s3:products/v1/abc.thumb.webp');
    expect(cacheKeyForImageSrc(url2)).toBe('s3:products/v1/abc.thumb.webp');
    expect(extractS3ImageKey(url)).toBe('products/v1/abc.thumb.webp');
    expect(isIndexedDbCacheableImageSrc(url)).toBe(true);
  });

  it('does not IndexedDB-cache arbitrary third-party URLs', () => {
    expect(cacheKeyForImageSrc('https://cdn.example.com/photo.jpg')).toBeNull();
    expect(isIndexedDbCacheableImageSrc('https://cdn.example.com/photo.jpg')).toBe(false);
  });

  it('returns null for empty src', () => {
    expect(cacheKeyForImageSrc('')).toBeNull();
    expect(cacheKeyForImageSrc(null)).toBeNull();
  });

  it('extracts bare vendor and media keys', () => {
    expect(extractS3ImageKey('vendors/foo/profile.jpg')).toBe('vendors/foo/profile.jpg');
    expect(extractS3ImageKey('media/vendor/abc/x.webp')).toBe('media/vendor/abc/x.webp');
    expect(isManagedVendorMediaKey('vendors/foo/profile.jpg')).toBe(true);
    expect(isManagedVendorMediaKey('https://cdn.example.com/x.jpg')).toBe(false);
  });

  it('marks amazonaws urls and bare keys as refreshable', () => {
    expect(
      isRefreshableManagedImageSrc(
        'https://warmpawz-prod-user-uploads.s3.ap-south-1.amazonaws.com/vendors/a.jpg?X-Amz-Signature=x',
      ),
    ).toBe(true);
    expect(isRefreshableManagedImageSrc('vendors/foo/profile.jpg')).toBe(true);
    expect(isRefreshableManagedImageSrc('https://cdn.example.com/photo.jpg')).toBe(false);
    expect(isRefreshableManagedImageSrc('not-a-photo')).toBe(false);
  });
});

describe('getStaticImagePrewarmPaths', () => {
  it('includes category cards, shop tiles, and logo', async () => {
    const { getStaticImagePrewarmPaths } = await import('../static-image-prewarm');
    const paths = getStaticImagePrewarmPaths();
    expect(paths).toContain('/images/home/vet.webp');
    expect(paths).toContain('/logo.webp');
    expect(paths).toContain('/images/shop/categories/pet-food.jpeg');
    expect(new Set(paths).size).toBe(paths.length);
  });
});
