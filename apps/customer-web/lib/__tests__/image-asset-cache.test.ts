import {
  cacheKeyForImageSrc,
  extractS3ImageKey,
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

  it('builds s3 cache keys from presigned URLs', () => {
    const url =
      'https://warmpawz-prod-user-uploads.s3.ap-south-1.amazonaws.com/products/v1/abc.thumb.webp?X-Amz-Signature=foo';
    expect(cacheKeyForImageSrc(url)).toBe('s3:products/v1/abc.thumb.webp');
    expect(extractS3ImageKey(url)).toBe('products/v1/abc.thumb.webp');
  });

  it('returns null for empty src', () => {
    expect(cacheKeyForImageSrc('')).toBeNull();
    expect(cacheKeyForImageSrc(null)).toBeNull();
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
