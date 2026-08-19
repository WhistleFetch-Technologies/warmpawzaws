import { pickTaxCategoryConfiguredRate, pickTaxCategoryDisplayRate } from '../tax-category-display-rate';

describe('tax-category-display-rate', () => {
  test('uses default_gst_rate when tax_rate is the schema default 0', () => {
    expect(pickTaxCategoryConfiguredRate({ tax_rate: 0, default_gst_rate: 18 })).toBe(18);
    expect(pickTaxCategoryDisplayRate({ tax_rate: 0, default_gst_rate: 18 })).toBe(18);
  });

  test('keeps an explicit 0% Admin rate', () => {
    expect(pickTaxCategoryConfiguredRate({ tax_rate: 0, default_gst_rate: 0 })).toBe(0);
  });

  test('returns null when no rate is stored — callers must not invent 18%', () => {
    expect(pickTaxCategoryConfiguredRate({})).toBeNull();
    expect(pickTaxCategoryDisplayRate({})).toBe(0);
  });
});
