import {
  STOREFRONT_ACTIVE_STATUS_SQL,
  STOREFRONT_LEGACY_ACTIVE_STATUS_SQL,
  STOREFRONT_ACTIVE_CATEGORY_SQL,
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
});
