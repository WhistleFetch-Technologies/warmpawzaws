import {
  MERCHANT_SOLO_PROVIDER_EXPR,
  merchantCategoryFilterSql,
} from '../merchant-role-sql';

describe('merchant-role-sql', () => {
  it('derives is_solo_provider from vendor_type and roles without referencing vendors.is_solo_provider', () => {
    expect(MERCHANT_SOLO_PROVIDER_EXPR).toContain('v.vendor_type');
    expect(MERCHANT_SOLO_PROVIDER_EXPR).toContain('r.config');
    expect(MERCHANT_SOLO_PROVIDER_EXPR).not.toContain('v.is_solo_provider');
  });

  it('builds category filter against role-derived category expressions', () => {
    const sql = merchantCategoryFilterSql('$1');
    expect(sql).toContain('r.config');
    expect(sql).toContain('v.category');
    expect(sql).not.toContain('r.category');
  });
});
