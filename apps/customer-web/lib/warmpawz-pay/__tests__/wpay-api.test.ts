import { buildWpayVendorsUrl, wpayResolvedCategory } from '../wpay-api';

describe('buildWpayVendorsUrl', () => {
  it('includes q when sentence search is active', () => {
    const url = buildWpayVendorsUrl({
      limit: 5,
      category: 'all',
      q: 'best trainers for my dog',
    });
    expect(url).toContain('q=best+trainers+for+my+dog');
    expect(url).toContain('limit=5');
  });

  it('omits q when empty', () => {
    const url = buildWpayVendorsUrl({ limit: 5, category: 'training' });
    expect(url).not.toContain('q=');
    expect(url).toContain('category=training');
  });
});

describe('wpayResolvedCategory', () => {
  it('reads resolvedCategory from API envelope', () => {
    expect(wpayResolvedCategory({ resolvedCategory: 'training' })).toBe('training');
    expect(wpayResolvedCategory({})).toBeNull();
  });
});
