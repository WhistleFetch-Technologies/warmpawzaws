import {
  buildDisplayWebpKey,
  buildThumbWebpKey,
  buildCleanupKey,
  isWebpKey,
} from '../image-key-builder';

describe('image-key-builder', () => {
  it('builds versioned customer profile key', () => {
    const key = buildDisplayWebpKey({
      assetType: 'profile',
      ownerId: '9845299005',
      suffix: 'abc123',
    });
    expect(key).toBe('media/customer/9845299005/profile_abc123.webp');
    expect(isWebpKey(key)).toBe(true);
  });

  it('builds product thumb sibling key', () => {
    const display = 'products/vendor1/img1.webp';
    expect(buildThumbWebpKey(display)).toBe('products/vendor1/img1.thumb.webp');
  });

  it('builds cleanup prefix for replaced keys', () => {
    expect(buildCleanupKey('media/customer/x/profile_old.webp')).toBe(
      'cleanup/media/customer/x/profile_old.webp',
    );
  });
});
