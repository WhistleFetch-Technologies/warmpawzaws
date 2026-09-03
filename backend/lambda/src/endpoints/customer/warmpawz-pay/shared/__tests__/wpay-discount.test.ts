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

  it('assertDiscountBelowCommission enforces D < C', () => {
    expect(() => assertDiscountBelowCommission(20, 15)).not.toThrow();
    expect(() => assertDiscountBelowCommission(20, 20)).toThrow(WpayCommercialValidationError);
  });
});
