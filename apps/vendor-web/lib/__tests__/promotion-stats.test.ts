import {
  sumNumeric,
  formatRevenueStat,
  getEffectivePromotionStatus,
  getToggleLabel,
  parseNumeric,
} from '../promotion-stats';

describe('promotion-stats', () => {
  it('sumNumeric avoids string concatenation NaN', () => {
    expect(sumNumeric(['0.00', '100.50', null])).toBe(100.5);
    expect(sumNumeric([])).toBe(0);
  });

  it('parseNumeric handles invalid values', () => {
    expect(parseNumeric('abc')).toBe(0);
    expect(parseNumeric('12.5')).toBe(12.5);
  });

  it('formatRevenueStat shows zero without NaN', () => {
    expect(formatRevenueStat(0)).toBe('₹0');
    expect(formatRevenueStat(NaN)).toBe('₹0');
    expect(formatRevenueStat(1500)).toBe('₹1.5k');
    expect(formatRevenueStat(500)).toBe('₹500');
  });

  it('getEffectivePromotionStatus respects dates and is_active', () => {
    const now = new Date('2026-06-26T12:00:00.000Z');
    const promo = {
      is_active: true,
      start_date: '2026-06-20T00:00:00.000Z',
      end_date: '2026-06-30T23:59:59.999Z',
    };
    expect(getEffectivePromotionStatus(promo, now)).toBe('live');

    expect(
      getEffectivePromotionStatus({ ...promo, is_active: false }, now)
    ).toBe('inactive');

    expect(
      getEffectivePromotionStatus(
        { ...promo, end_date: '2026-06-25T00:00:00.000Z' },
        now
      )
    ).toBe('expired');
  });

  it('getToggleLabel shows Active (expired) when flag on but past end', () => {
    const now = new Date('2026-06-26T12:00:00.000Z');
    expect(
      getToggleLabel(
        {
          is_active: true,
          start_date: '2026-06-01T00:00:00.000Z',
          end_date: '2026-06-25T00:00:00.000Z',
        },
        now
      )
    ).toBe('Active (expired)');
  });
});
