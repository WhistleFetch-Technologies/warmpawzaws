import {
  PRODUCT_S3_PREFIX,
  collectAllProductImageUrls,
  diffRemovedManagedKeys,
  extractProductS3Key,
  isManagedProductS3Image,
} from '../product-s3-image';

describe('product-s3-image', () => {
  const vendorId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  const key = `${PRODUCT_S3_PREFIX}${vendorId}/123_abc.webp`;

  it('extractProductS3Key reads raw key scoped to vendor', () => {
    expect(extractProductS3Key(key, vendorId)).toBe(key);
    expect(extractProductS3Key(key, 'other-vendor-id')).toBeNull();
  });

  it('extractProductS3Key reads virtual-hosted S3 URL', () => {
    const url = `https://warmpawz-dev-uploads.s3.ap-south-1.amazonaws.com/${key}`;
    expect(extractProductS3Key(url, vendorId)).toBe(key);
  });

  it('extractProductS3Key strips presigned query params', () => {
    const url = `https://warmpawz-dev-uploads.s3.ap-south-1.amazonaws.com/${key}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=x`;
    expect(extractProductS3Key(url, vendorId)).toBe(key);
  });

  it('extractProductS3Key returns null for external URLs', () => {
    expect(extractProductS3Key('https://cdn.example.com/product.jpg', vendorId)).toBeNull();
    expect(extractProductS3Key(null, vendorId)).toBeNull();
    expect(extractProductS3Key('', vendorId)).toBeNull();
  });

  it('isManagedProductS3Image detects managed keys only', () => {
    expect(isManagedProductS3Image(key, vendorId)).toBe(true);
    expect(isManagedProductS3Image('https://cdn.example.com/x.jpg', vendorId)).toBe(false);
  });

  it('collectAllProductImageUrls unions parent and SKU images', () => {
    const urls = collectAllProductImageUrls(
      { images: [key, 'https://cdn.example.com/x.jpg'] },
      [{ images: [key] }, { images: [`${PRODUCT_S3_PREFIX}${vendorId}/other.jpg`] }],
    );
    expect(urls).toHaveLength(3);
    expect(urls).toContain(key);
    expect(urls).toContain('https://cdn.example.com/x.jpg');
  });

  it('diffRemovedManagedKeys keeps shared keys until removed everywhere', () => {
    const shared = key;
    const removed = diffRemovedManagedKeys(
      [shared, `${PRODUCT_S3_PREFIX}${vendorId}/gone.jpg`],
      [shared],
      vendorId,
    );
    expect(removed).toEqual([`${PRODUCT_S3_PREFIX}${vendorId}/gone.jpg`]);
  });

  it('diffRemovedManagedKeys ignores external URLs', () => {
    expect(
      diffRemovedManagedKeys(
        ['https://cdn.example.com/old.jpg'],
        [],
        vendorId,
      ),
    ).toEqual([]);
  });
});
