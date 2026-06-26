import {
  ALLOWED_PRODUCT_IMAGE_TYPES,
  isManagedProductStorageKey,
  PRODUCT_IMAGE_MAX_BYTES,
  PRODUCT_IMAGE_MAX_EDGE_PX,
  PRODUCT_IMAGE_MAX_INPUT_BYTES,
  PRODUCT_S3_KEY_PREFIX,
  validateProductImageFile,
} from '../compress-product-image';

describe('compress-product-image validation', () => {
  it('validateProductImageFile rejects empty and unsupported types', () => {
    expect(validateProductImageFile(new File([], 'empty.jpg', { type: 'image/jpeg' })).ok).toBe(
      false,
    );
    expect(
      validateProductImageFile(new File(['x'], 'x.svg', { type: 'image/svg+xml' })).ok,
    ).toBe(false);
  });

  it('validateProductImageFile accepts jpeg/png/webp', () => {
    for (const type of ALLOWED_PRODUCT_IMAGE_TYPES) {
      expect(validateProductImageFile(new File(['x'], 'photo.jpg', { type })).ok).toBe(true);
    }
  });

  it('validateProductImageFile rejects files over max input size', () => {
    const big = new Array(PRODUCT_IMAGE_MAX_INPUT_BYTES + 1).fill('a').join('');
    expect(validateProductImageFile(new File([big], 'big.jpg', { type: 'image/jpeg' })).ok).toBe(
      false,
    );
  });

  it('isManagedProductStorageKey detects products/ prefix', () => {
    expect(isManagedProductStorageKey('products/vendor-id/abc.webp')).toBe(true);
    expect(isManagedProductStorageKey('admin/banners/x.webp')).toBe(false);
  });

  it('exports expected constants', () => {
    expect(PRODUCT_IMAGE_MAX_BYTES).toBe(500 * 1024);
    expect(PRODUCT_IMAGE_MAX_EDGE_PX).toBe(4000);
    expect(PRODUCT_S3_KEY_PREFIX).toBe('products/');
  });
});
