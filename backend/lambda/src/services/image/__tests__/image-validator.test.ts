import { detectImageMime, validateImageBuffer } from '../image-validator';

describe('image-validator', () => {
  const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);

  it('detects JPEG magic bytes', () => {
    expect(detectImageMime(jpegHeader)).toBe('image/jpeg');
  });

  it('rejects empty buffer', () => {
    const result = validateImageBuffer(Buffer.alloc(0));
    expect(result.ok).toBe(false);
  });

  it('rejects fake MIME when bytes are not image', () => {
    const result = validateImageBuffer(Buffer.from('not-an-image'), 'image/jpeg');
    expect(result.ok).toBe(false);
  });

  it('accepts valid JPEG buffer', () => {
    const buf = Buffer.concat([jpegHeader, Buffer.alloc(64)]);
    const result = validateImageBuffer(buf, 'image/jpeg');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.detectedMime).toBe('image/jpeg');
  });
});
