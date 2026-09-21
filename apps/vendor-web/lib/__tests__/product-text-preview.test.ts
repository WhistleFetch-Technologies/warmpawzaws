import { productTextNeedsViewMore, productTextPreview } from '../product-text-preview';

describe('product text preview', () => {
  it('does not add View more for short copy', () => {
    const result = productTextPreview('Elegant festive lehenga.');
    expect(result.showViewMore).toBe(false);
    expect(result.preview).toBe('Elegant festive lehenga.');
  });

  it('truncates long key features and flags View more', () => {
    const long =
      'Give your pet a festive makeover with our Dog Kurta – where tradition meets comfort and style. Made from lightweight cotton for all-day wear on Diwali, Holi, and family gatherings.';
    expect(productTextNeedsViewMore(long)).toBe(true);
    const result = productTextPreview(long);
    expect(result.showViewMore).toBe(true);
    expect(result.preview.length).toBeLessThan(long.length);
    expect(result.preview.endsWith('…')).toBe(true);
  });
});
