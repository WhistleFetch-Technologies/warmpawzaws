import {
  STOREFRONT_ACTIVE_STATUS_SQL,
  STOREFRONT_LEGACY_ACTIVE_STATUS_SQL,
  STOREFRONT_ACTIVE_CATEGORY_SQL,
  STOREFRONT_VENDOR_NOT_HIDDEN_SQL,
  parseEcommerceStorefrontVisibilityBody,
} from '../storefront-product-where';

describe('storefront-product-where', () => {
  it('exports sargable active status SQL using alias p', () => {
    expect(STOREFRONT_ACTIVE_STATUS_SQL).toContain('p.is_active = true');
    expect(STOREFRONT_ACTIVE_STATUS_SQL).toContain("= 'active'");
    expect(STOREFRONT_ACTIVE_STATUS_SQL).not.toContain('NULLIF');
  });

  it('legacy status SQL matches prior handler expression', () => {
    expect(STOREFRONT_LEGACY_ACTIVE_STATUS_SQL).toContain('NULLIF(TRIM(p.status::text)');
    expect(STOREFRONT_LEGACY_ACTIVE_STATUS_SQL).toContain("'pending'");
  });

  it('active category SQL requires active ecommerce_categories or null category_id', () => {
    expect(STOREFRONT_ACTIVE_CATEGORY_SQL).toContain('ecommerce_categories');
    expect(STOREFRONT_ACTIVE_CATEGORY_SQL).toContain('p.category_id IS NULL');
  });

  it('vendor hide SQL skips products whose vendor is storefront-hidden', () => {
    expect(STOREFRONT_VENDOR_NOT_HIDDEN_SQL).toContain('ecommerce_storefront_hidden');
    expect(STOREFRONT_VENDOR_NOT_HIDDEN_SQL).toContain('p.vendor_id');
    expect(STOREFRONT_VENDOR_NOT_HIDDEN_SQL).toContain('NOT EXISTS');
  });

  it('parses published / hidden storefront visibility body', () => {
    expect(parseEcommerceStorefrontVisibilityBody({ published: false })).toEqual({
      published: false,
      hidden: true,
    });
    expect(parseEcommerceStorefrontVisibilityBody({ hidden: true })).toEqual({
      published: false,
      hidden: true,
    });
    expect(parseEcommerceStorefrontVisibilityBody({ published: true, hidden: true })).toEqual({
      published: true,
      hidden: false,
    });
    expect(parseEcommerceStorefrontVisibilityBody({})).toBeNull();
  });
});
