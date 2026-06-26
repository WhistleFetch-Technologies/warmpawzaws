import {
  ALLOWED_BANNER_IMAGE_TYPES,
  BANNER_IMAGE_MAX_EDGE_PX,
  BANNER_IMAGE_MAX_INPUT_BYTES,
  BANNER_S3_KEY_PREFIX,
  formatBannerImageSizeLabel,
  isManagedBannerStorageKey,
  validateBannerImageFile,
} from '../compress-banner-image';

describe('compress-banner-image validation', () => {
  it('validateBannerImageFile rejects empty files', () => {
    const file = new File([], 'empty.png', { type: 'image/png' });
    expect(validateBannerImageFile(file)).toEqual({
      ok: false,
      message: 'Please select an image file',
    });
  });

  it('validateBannerImageFile rejects unsupported types', () => {
    const file = new File(['x'], 'banner.svg', { type: 'image/svg+xml' });
    expect(validateBannerImageFile(file).ok).toBe(false);
  });

  it('validateBannerImageFile accepts png/jpeg/webp', () => {
    for (const type of ALLOWED_BANNER_IMAGE_TYPES) {
      const file = new File(['x'], 'banner.bin', { type });
      expect(validateBannerImageFile(file)).toEqual({ ok: true });
    }
  });

  it('validateBannerImageFile rejects files over 10 MB', () => {
    const big = new Array(BANNER_IMAGE_MAX_INPUT_BYTES + 1).fill('a').join('');
    const file = new File([big], 'big.jpg', { type: 'image/jpeg' });
    expect(validateBannerImageFile(file).ok).toBe(false);
  });

  it('isManagedBannerStorageKey detects admin banner keys', () => {
    expect(isManagedBannerStorageKey('admin/banners/abc.webp')).toBe(true);
    expect(isManagedBannerStorageKey('https://cdn.example.com/a.jpg')).toBe(false);
  });

  it('formatBannerImageSizeLabel formats bytes and kilobytes', () => {
    expect(formatBannerImageSizeLabel(512)).toBe('512 B');
    expect(formatBannerImageSizeLabel(2048)).toBe('2.0 KB');
  });

  it('documents max edge guard constant', () => {
    expect(BANNER_IMAGE_MAX_EDGE_PX).toBe(4000);
    expect(BANNER_S3_KEY_PREFIX).toBe('admin/banners/');
  });
});
