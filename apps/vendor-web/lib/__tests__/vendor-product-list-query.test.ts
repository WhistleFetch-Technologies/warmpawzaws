import {
  VENDOR_PRODUCT_PAGE_SIZE,
  buildVendorProductListQuery,
  vendorProductListPath,
} from '../vendor-product-list-query';

describe('buildVendorProductListQuery', () => {
  it('defaults limit to 50 and includes offset', () => {
    const qs = buildVendorProductListQuery({ offset: 0 });
    expect(qs).toBe('limit=50&offset=0');
    expect(VENDOR_PRODUCT_PAGE_SIZE).toBe(50);
  });

  it('includes search, category, and status when set', () => {
    const qs = buildVendorProductListQuery({
      offset: 100,
      search: 'bone',
      category: 'cat-1',
      serverStatus: 'active',
    });
    expect(qs).toContain('limit=50');
    expect(qs).toContain('offset=100');
    expect(qs).toContain('search=bone');
    expect(qs).toContain('category=cat-1');
    expect(qs).toContain('status=active');
  });

  it('omits category when all', () => {
    const qs = buildVendorProductListQuery({ offset: 0, category: 'all' });
    expect(qs).not.toContain('category=');
  });
});

describe('vendorProductListPath', () => {
  it('builds vendor products path', () => {
    expect(vendorProductListPath('vendor-1', { offset: 50 })).toBe(
      '/vendor/vendor-1/products?limit=50&offset=50',
    );
  });
});
