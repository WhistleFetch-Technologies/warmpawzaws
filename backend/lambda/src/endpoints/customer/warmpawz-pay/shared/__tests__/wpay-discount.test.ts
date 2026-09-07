import {
  assertDiscountBelowCommission,
  computeWpayCommercialQuote,
  computeWpayDiscountQuote,
  WpayCommercialValidationError,
} from '../wpay-discount';

describe('computeWpayDiscountQuote', () => {
  it('applies percentage discount on full quoted amount (appointment credit ignored)', () => {
    const quote = computeWpayDiscountQuote(1000, 10, null);
    expect(quote).toEqual({
      originalAmount: 1000,
      appointmentFeeCredit: 0,
      billBase: 1000,
      discountPercent: 10,
      discountAmount: 100,
      payableAmount: 900,
    });
  });

  it('ignores appointment fee credit when provided', () => {
    const quote = computeWpayDiscountQuote(800, 10, { appointmentFeeCredit: 200 });
    expect(quote).toEqual({
      originalAmount: 800,
      appointmentFeeCredit: 0,
      billBase: 800,
      discountPercent: 10,
      discountAmount: 80,
      payableAmount: 720,
    });
  });

  it('honors maxDiscountAmount cap on bill base', () => {
    const quote = computeWpayDiscountQuote(1000, 20, { maxDiscountAmount: 50 });
    expect(quote.discountAmount).toBe(50);
    expect(quote.payableAmount).toBe(950);
  });

  it('rejects invalid quoted amounts', () => {
    expect(() => computeWpayDiscountQuote(0, 10, null)).toThrow('Invalid bill amount');
    expect(() => computeWpayDiscountQuote(-100, 10, null)).toThrow('Invalid bill amount');
  });
});

describe('computeWpayCommercialQuote', () => {
  const base = {
    quotedAmount: 10_000,
    commissionPercent: 20,
    discountPercent: 15,
  };

  it('case 1: walk-in tier math without fees', () => {
    const quote = computeWpayCommercialQuote({ ...base, convenienceFee: 0, platformFee: 0 });
    expect(quote.grossCommissionAmount).toBe(2000);
    expect(quote.discountAmount).toBe(1500);
    expect(quote.vendorPayableAmount).toBe(8000);
    expect(quote.servicePayableAmount).toBe(8500);
    expect(quote.wpayRevenueAmount).toBe(500);
    expect(quote.platformGstAmount).toBe(76.27);
    expect(quote.convenienceGstAmount).toBe(0);
    expect(quote.platformFeeGstAmount).toBe(0);
    expect(quote.finalGstAmount).toBe(76.27);
    expect(quote.payNowAmount).toBe(8500);
    expect(quote.appointmentFeeCredit).toBe(0);
  });

  it('case 2: appointment credit input is ignored', () => {
    const quote = computeWpayCommercialQuote({
      ...base,
      appointmentFeeCredit: 200,
      convenienceFee: 0,
      platformFee: 0,
    });
    expect(quote.vendorPayableAmount).toBe(8000);
    expect(quote.wpayRevenueAmount).toBe(500);
    expect(quote.serviceDueAfterCredit).toBe(8500);
    expect(quote.payNowAmount).toBe(8500);
    expect(quote.appointmentFeeCredit).toBe(0);
  });

  it('case 3: platform fee + convenience with exclusive GST on top', () => {
    const quote = computeWpayCommercialQuote({
      ...base,
      platformFee: 30,
      platformFeeGstRate: 18,
      convenienceFee: 20,
      convenienceGstRate: 18,
      platformGstRate: 18,
    });
    expect(quote.platformFeeGstAmount).toBe(5.4);
    expect(quote.platformFeeGrossAmount).toBe(35.4);
    expect(quote.convenienceGstAmount).toBe(3.6);
    expect(quote.convenienceGrossAmount).toBe(23.6);
    expect(quote.finalGstAmount).toBe(85.27);
    expect(quote.payNowAmount).toBe(8559);
  });

  it('case 4: convenience only', () => {
    const quote = computeWpayCommercialQuote({
      ...base,
      convenienceFee: 20,
      convenienceGstRate: 18,
    });
    expect(quote.payNowAmount).toBe(8523.6);
    expect(quote.finalGstAmount).toBe(79.87);
  });

  it('case 5: rejects discount equal to commission', () => {
    expect(() =>
      computeWpayCommercialQuote({ ...base, discountPercent: 20 }),
    ).toThrow(WpayCommercialValidationError);
  });

  it('case 6: rejects discount above commission', () => {
    expect(() =>
      computeWpayCommercialQuote({ ...base, discountPercent: 21 }),
    ).toThrow(WpayCommercialValidationError);
  });

  it('case 7: accepts discount below commission', () => {
    expect(() =>
      computeWpayCommercialQuote({ ...base, discountPercent: 15 }),
    ).not.toThrow();
  });

  it('case 8: burn mode — same payNow, vendor gets full Q, platform revenue 0', () => {
    const normal = computeWpayCommercialQuote({
      ...base,
      platformFee: 30,
      platformFeeGstRate: 18,
      convenienceFee: 20,
      convenienceGstRate: 18,
      burnMode: false,
    });
    const burned = computeWpayCommercialQuote({
      ...base,
      platformFee: 30,
      platformFeeGstRate: 18,
      convenienceFee: 20,
      convenienceGstRate: 18,
      burnMode: true,
    });
    expect(burned.payNowAmount).toBe(normal.payNowAmount);
    expect(burned.servicePayableAmount).toBe(8500);
    expect(burned.discountAmount).toBe(1500);
    expect(burned.vendorPayableAmount).toBe(10_000);
    expect(burned.wpayRevenueAmount).toBe(0);
    expect(burned.platformGstAmount).toBe(0);
    expect(burned.burnMode).toBe(true);
    expect(burned.burnAmount).toBe(1441);
    expect(normal.vendorPayableAmount).toBe(8000);
    expect(normal.burnMode).toBe(false);
    expect(normal.burnAmount).toBe(0);
  });

  it('case 9: percent fees use post-discount amount, not original quote', () => {
    // Q=1000, D=15% → discount=150, servicePayable=850
    // platform 2% of 850 = 17; convenience 1% of 850 = 8.5
    const quote = computeWpayCommercialQuote({
      quotedAmount: 1000,
      commissionPercent: 20,
      discountPercent: 15,
      platformFee: 2,
      platformFeeMode: 'percent',
      platformFeeGstRate: 18,
      convenienceFee: 1,
      convenienceFeeMode: 'percent',
      convenienceGstRate: 18,
    });
    expect(quote.servicePayableAmount).toBe(850);
    expect(quote.platformFee).toBe(17);
    expect(quote.platformFeeGstAmount).toBe(3.06);
    expect(quote.convenienceFee).toBe(8.5);
    expect(quote.convenienceGstAmount).toBe(1.53);
    expect(quote.payNowAmount).toBe(880.09);
  });

  it('case 10: guardrail zeros all fees when total fees >= discount', () => {
    // Q=100, D=10% → discount=10, servicePayable=90
    // fees 8+1.44+2+0.36 = 11.8 >= 10 → zero
    const quote = computeWpayCommercialQuote({
      quotedAmount: 100,
      commissionPercent: 20,
      discountPercent: 10,
      platformFee: 8,
      platformFeeMode: 'fixed',
      platformFeeGstRate: 18,
      convenienceFee: 2,
      convenienceFeeMode: 'fixed',
      convenienceGstRate: 18,
    });
    expect(quote.discountAmount).toBe(10);
    expect(quote.platformFee).toBe(0);
    expect(quote.platformFeeGstAmount).toBe(0);
    expect(quote.convenienceFee).toBe(0);
    expect(quote.convenienceGstAmount).toBe(0);
    expect(quote.payNowAmount).toBe(90);
  });

  it('case 11: guardrail also fires when total fees exactly equal discount', () => {
    const quote = computeWpayCommercialQuote({
      quotedAmount: 1000,
      commissionPercent: 20,
      discountPercent: 10,
      platformFee: 100,
      platformFeeMode: 'fixed',
      platformFeeGstRate: 0,
      convenienceFee: 0,
      convenienceFeeMode: 'fixed',
      convenienceGstRate: 0,
    });
    expect(quote.discountAmount).toBe(100);
    expect(quote.platformFee).toBe(0);
    expect(quote.payNowAmount).toBe(900);
  });

  it('assertDiscountBelowCommission enforces D < C', () => {
    expect(() => assertDiscountBelowCommission(20, 15)).not.toThrow();
    expect(() => assertDiscountBelowCommission(20, 20)).toThrow(WpayCommercialValidationError);
  });
});
