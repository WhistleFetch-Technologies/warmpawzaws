import { applyEngineDiscountToWpayPayable } from '../apply-engine-discount-to-wpay';

describe('applyEngineDiscountToWpayPayable', () => {
  it('subtracts engine discount from withhold payable', () => {
    const result = applyEngineDiscountToWpayPayable({
      quotedAmount: 1000,
      cataloguePayable: 1000,
      engineDiscount: 150,
      metadata: { commercialModel: 'withhold', quotedDiscountAmount: 0 },
    });
    expect(result.discountAmount).toBe(150);
    expect(result.payableAmount).toBe(850);
    expect(result.metadata.quotedDiscountAmount).toBe(150);
  });

  it('keeps Razorpay payable at least ₹1 when engine covers the bill', () => {
    const result = applyEngineDiscountToWpayPayable({
      quotedAmount: 500,
      cataloguePayable: 500,
      engineDiscount: 500,
      metadata: {},
    });
    expect(result.payableAmount).toBe(1);
    expect(result.discountAmount).toBe(499);
  });

  it('reduces tier wpay revenue so settlement matches customer paid', () => {
    const result = applyEngineDiscountToWpayPayable({
      quotedAmount: 1000,
      cataloguePayable: 1060,
      engineDiscount: 100,
      metadata: {
        commercialModel: 'tier_commission',
        payNowAmount: 1060,
        grossCommissionAmount: 200,
        wpayRevenueAmount: 200,
      },
    });
    expect(result.payableAmount).toBe(960);
    expect(result.metadata.payNowAmount).toBe(960);
    expect(result.metadata.wpayRevenueAmount).toBe(100);
  });
});
