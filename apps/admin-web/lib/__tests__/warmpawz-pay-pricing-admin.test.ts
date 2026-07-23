import { validatePricingForm, formatDiscountValue } from '@/lib/warmpawz-pay-pricing-admin';

describe('warmpawz-pay-pricing-admin', () => {
  it('formats percentage discount values', () => {
    expect(formatDiscountValue('percentage', 12.5)).toBe('12.5%');
  });

  it('rejects discount values outside 0-100', () => {
    expect(
      validatePricingForm({
        discountValue: 101,
        effectiveFrom: '2026-07-01T00:00:00.000Z',
      }),
    ).toMatch(/between 0 and 100/);
  });

  it('rejects effective until before effective from', () => {
    expect(
      validatePricingForm({
        discountValue: 10,
        effectiveFrom: '2026-08-01T00:00:00.000Z',
        effectiveUntil: '2026-07-01T00:00:00.000Z',
      }),
    ).toMatch(/Effective until/);
  });
});
