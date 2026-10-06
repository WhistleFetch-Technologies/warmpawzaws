import { packageChargeAfterPromo } from '../package-promo-charge';

describe('packageChargeAfterPromo', () => {
  it('subtracts the engine discount from the package total and keeps GST', () => {
    expect(
      packageChargeAfterPromo({
        grossTotal: 1180,
        basePrice: 1000,
        gstAmount: 180,
        engineDiscount: 100,
      })
    ).toEqual({ discount: 100, chargeGross: 1080 });
  });

  it('charges the full total when the promo does not apply', () => {
    expect(
      packageChargeAfterPromo({
        grossTotal: 1180,
        basePrice: 1000,
        gstAmount: 180,
        engineDiscount: 0,
      })
    ).toEqual({ discount: 0, chargeGross: 1180 });
  });

  it('does not discount below the GST that must still be collected', () => {
    expect(
      packageChargeAfterPromo({
        grossTotal: 1180,
        basePrice: 1000,
        gstAmount: 180,
        engineDiscount: 5000,
      })
    ).toEqual({ discount: 1000, chargeGross: 180 });
  });
});
