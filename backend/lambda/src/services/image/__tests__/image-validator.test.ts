import { detectImageMime, validateImageBuffer, validateImageDimensions } from '../image-validator';

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

  it('rejects truncated JPEG in validateImageDimensions', async () => {
    const buf = Buffer.concat([jpegHeader, Buffer.alloc(8)]);
    const result = await validateImageDimensions(buf);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/Corrupted|dimensions|Unsupported/i);
    }
  });

  it('returns HEIC-specific message when Sharp cannot decode HEIC', async () => {
    // ISO BMFF ftyp heic — passes magic-byte sniff, fails Sharp decode on linux
    const heicHeader = Buffer.from([
      0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63,
    ]);
    const buf = Buffer.concat([heicHeader, Buffer.alloc(128)]);
    const result = await validateImageDimensions(buf);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('HEIC/HEIF');
    }
  });
});
