import {
  calculateEcommerceSettlement,
  computeTaxableValue,
  settlementReconciles,
} from '../ecommerce-settlement-calculator';

/**
 * Worked example from the Ecommerce Settlement Engine plan §1:
 * MRP ₹1180, GST 18% ⇒ T=₹1000, G=₹180; commission 10% ⇒ Comm=₹100; discount D=₹118.
 */
const MERCHANDISE_VALUE = 1180;
const GST_RATE = 18;
const COMMISSION_RATE = 10;
const DISCOUNT_AMOUNT = 118;

describe('computeTaxableValue', () => {
  it('divides out GST from a GST-inclusive amount', () => {
    expect(computeTaxableValue(1180, 18)).toBeCloseTo(1000, 2);
  });

  it('returns the amount unchanged when gstRate is 0', () => {
    expect(computeTaxableValue(1000, 0)).toBe(1000);
  });
});

describe('calculateEcommerceSettlement — Scenario 1: no promotion', () => {
  it('vendor gets merchandise value minus commission; platform keeps commission', () => {
    const result = calculateEcommerceSettlement({
      merchandiseValue: MERCHANDISE_VALUE,
      gstRate: GST_RATE,
      commissionRate: COMMISSION_RATE,
      promotionSource: null,
    });

    expect(result.taxableValue).toBeCloseTo(1000, 2);
    expect(result.gstAmount).toBeCloseTo(180, 2);
    expect(result.commissionAmount).toBeCloseTo(100, 2);
    expect(result.discountAmount).toBe(0);
    expect(result.vendorPayoutAmount).toBeCloseTo(1080, 2);
    expect(result.platformNetAmount).toBeCloseTo(100, 2);
    expect(result.customerPayableGoods).toBeCloseTo(1180, 2);
    expect(settlementReconciles(result)).toBe(true);
  });
});

describe('calculateEcommerceSettlement — Scenario 2: vendor-funded promotion', () => {
  it('vendor absorbs the discount in full; commission is unaffected', () => {
    const result = calculateEcommerceSettlement({
      merchandiseValue: MERCHANDISE_VALUE,
      gstRate: GST_RATE,
      commissionRate: COMMISSION_RATE,
      promotionSource: 'vendor',
      discountAmount: DISCOUNT_AMOUNT,
    });

    expect(result.commissionAmount).toBeCloseTo(100, 2);
    expect(result.vendorPayoutAmount).toBeCloseTo(962, 2);
    expect(result.platformNetAmount).toBeCloseTo(100, 2);
    expect(result.customerPayableGoods).toBeCloseTo(1062, 2);
    expect(settlementReconciles(result)).toBe(true);
  });
});

describe('calculateEcommerceSettlement — Scenario 3: admin/platform-funded promotion', () => {
  it('vendor is paid as if full price; platform subsidizes (net can go negative)', () => {
    const result = calculateEcommerceSettlement({
      merchandiseValue: MERCHANDISE_VALUE,
      gstRate: GST_RATE,
      commissionRate: COMMISSION_RATE,
      promotionSource: 'admin',
      discountAmount: DISCOUNT_AMOUNT,
    });

    expect(result.commissionAmount).toBeCloseTo(100, 2);
    expect(result.vendorPayoutAmount).toBeCloseTo(1080, 2);
    expect(result.platformNetAmount).toBeCloseTo(-18, 2);
    expect(result.customerPayableGoods).toBeCloseTo(1062, 2);
    expect(settlementReconciles(result)).toBe(true);
  });
});

describe('calculateEcommerceSettlement — commission is always on the original taxable value', () => {
  it('commission is identical across all three scenarios for the same order', () => {
    const base = {
      merchandiseValue: MERCHANDISE_VALUE,
      gstRate: GST_RATE,
      commissionRate: COMMISSION_RATE,
    };
    const none = calculateEcommerceSettlement({ ...base, promotionSource: null });
    const vendor = calculateEcommerceSettlement({
      ...base,
      promotionSource: 'vendor',
      discountAmount: DISCOUNT_AMOUNT,
    });
    const admin = calculateEcommerceSettlement({
      ...base,
      promotionSource: 'admin',
      discountAmount: DISCOUNT_AMOUNT,
    });

    expect(none.commissionAmount).toBe(vendor.commissionAmount);
    expect(vendor.commissionAmount).toBe(admin.commissionAmount);
  });
});

describe('calculateEcommerceSettlement — edge cases', () => {
  it('ignores a discount amount when promotionSource is null', () => {
    const result = calculateEcommerceSettlement({
      merchandiseValue: MERCHANDISE_VALUE,
      gstRate: GST_RATE,
      commissionRate: COMMISSION_RATE,
      promotionSource: null,
      discountAmount: 500,
    });
    expect(result.discountAmount).toBe(0);
  });

  it('accepts a pre-computed taxableValue instead of deriving it from gstRate', () => {
    const result = calculateEcommerceSettlement({
      merchandiseValue: 1180,
      taxableValue: 1000,
      commissionRate: COMMISSION_RATE,
      promotionSource: null,
    });
    expect(result.gstAmount).toBeCloseTo(180, 2);
    expect(result.commissionAmount).toBeCloseTo(100, 2);
  });

  it('never returns a negative vendor payout even for large discounts', () => {
    const result = calculateEcommerceSettlement({
      merchandiseValue: 100,
      gstRate: 18,
      commissionRate: 10,
      promotionSource: 'vendor',
      discountAmount: 10000,
    });
    expect(result.vendorPayoutAmount).toBe(0);
  });

  it('reconciliation invariant holds across a range of discount amounts and sources', () => {
    for (const promotionSource of ['vendor', 'admin', null] as const) {
      for (const discountAmount of [0, 50, 118, 500]) {
        const result = calculateEcommerceSettlement({
          merchandiseValue: MERCHANDISE_VALUE,
          gstRate: GST_RATE,
          commissionRate: COMMISSION_RATE,
          promotionSource,
          discountAmount,
        });
        expect(settlementReconciles(result)).toBe(true);
      }
    }
  });
});
