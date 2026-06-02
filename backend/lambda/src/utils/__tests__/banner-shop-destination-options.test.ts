import {
  clampShopBannerProductLimit,
  mapShopBannerProductRow,
  normalizeShopBannerProductSearch,
  STOREFRONT_ACTIVE_CATEGORY_SQL,
} from '../banner-shop-destination-options';

describe('banner-shop-destination-options helpers', () => {
  it('normalizes search input', () => {
    expect(normalizeShopBannerProductSearch('  kibble  ')).toBe('kibble');
    expect(normalizeShopBannerProductSearch(null)).toBe('');
  });

  it('clamps product limit between 1 and 100', () => {
    expect(clampShopBannerProductLimit('0')).toBe(50);
    expect(clampShopBannerProductLimit('25')).toBe(25);
    expect(clampShopBannerProductLimit('500')).toBe(100);
    expect(clampShopBannerProductLimit('abc')).toBe(50);
  });

  it('maps product rows for admin picker', () => {
    expect(
      mapShopBannerProductRow({
        id: '11111111-1111-1111-1111-111111111111',
        name: 'Dog Food',
        sku: 'DF-01',
        price: '499.50',
        status: 'active',
        category_name: 'Food',
      })
    ).toEqual({
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Dog Food',
      sku: 'DF-01',
      price: 499.5,
      status: 'active',
      category: 'Food',
    });
  });

  it('excludes products in inactive categories via SQL fragment', () => {
    expect(STOREFRONT_ACTIVE_CATEGORY_SQL).toContain('ec.is_active = true');
    expect(STOREFRONT_ACTIVE_CATEGORY_SQL).toContain('p.category_id IS NULL');
  });
});
