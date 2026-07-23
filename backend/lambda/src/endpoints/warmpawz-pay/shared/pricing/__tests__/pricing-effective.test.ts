import { isPricingConfigured, isPricingCurrentlyEffective } from '../pricing-effective';
import { PRICING_STATUS } from '../../../constants/merchant-pricing';

describe('pricing-effective', () => {
  const at = new Date('2026-07-15T12:00:00.000Z');

  it('returns true for active pricing within effective window', () => {
    expect(
      isPricingCurrentlyEffective(
        {
          status: PRICING_STATUS.ACTIVE,
          effectiveFrom: new Date('2026-07-01T00:00:00.000Z'),
          effectiveUntil: new Date('2026-08-01T00:00:00.000Z'),
          discountValue: 10,
        },
        at,
      ),
    ).toBe(true);
  });

  it('returns false for disabled pricing', () => {
    expect(
      isPricingConfigured({
        status: PRICING_STATUS.DISABLED,
        effectiveFrom: new Date('2026-07-01T00:00:00.000Z'),
        effectiveUntil: null,
        discountValue: 10,
      }),
    ).toBe(false);
  });
});
