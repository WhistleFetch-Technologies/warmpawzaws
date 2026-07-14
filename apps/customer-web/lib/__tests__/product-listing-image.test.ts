import {
  normalizeProductImageSrc,
  normalizeProductImagesList,
  pickShopProductListingImage,
} from '../product-listing-image';

describe('product-listing-image', () => {
  it('normalizes string and object image entries', () => {
    expect(normalizeProductImageSrc('https://example/a.webp')).toBe('https://example/a.webp');
    expect(
      normalizeProductImageSrc({
        displayUrl: 'https://example/thumb.webp',
        thumbUrl: 'https://example/thumb.webp',
        url: 'https://example/full.webp',
      })
    ).toBe('https://example/thumb.webp');
  });

  it('prefers product.thumbUrl over images[0]', () => {
    expect(
      pickShopProductListingImage({
        thumbUrl: 'https://example/explicit-thumb.webp',
        images: ['https://example/full.webp'],
      })
    ).toBe('https://example/explicit-thumb.webp');
  });

  it('falls back to first image when no thumbUrl', () => {
    expect(
      pickShopProductListingImage({
        images: [
          { thumbUrl: 'https://example/t.webp', url: 'https://example/f.webp' },
          'https://example/other.webp',
        ],
      })
    ).toBe('https://example/t.webp');
  });

  it('normalizes image lists', () => {
    expect(
      normalizeProductImagesList([
        { displayUrl: 'https://a/thumb.webp' },
        'https://b/full.webp',
        '',
      ])
    ).toEqual(['https://a/thumb.webp', 'https://b/full.webp']);
  });
});
