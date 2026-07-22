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

describe('resolveImageForContext', () => {
  it('returns thumb displayUrl for list context on WebP keys', async () => {
    const resolved = await resolveImageForContext('products/vendor1/abc.webp', {
      assetType: 'product',
      ownerId: 'vendor1',
      vendorId: 'vendor1',
      context: 'list',
      migrate: false,
    });
    expect(resolved).not.toBeNull();
    expect(resolved!.displayUrl).toContain('.thumb.webp');
    expect(resolved!.url).toContain('abc.webp');
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
});
