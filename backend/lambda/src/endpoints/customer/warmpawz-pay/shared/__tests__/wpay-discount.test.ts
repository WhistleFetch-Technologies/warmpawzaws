import { computeWpayDiscountQuote } from '../wpay-discount';

describe('computeWpayDiscountQuote', () => {
  it('applies percentage discount on full quoted amount when no appointment credit', () => {
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

  it('deducts appointment fee credit before applying discount', () => {
    const quote = computeWpayDiscountQuote(800, 10, { appointmentFeeCredit: 200 });
    expect(quote).toEqual({
      originalAmount: 800,
      appointmentFeeCredit: 200,
      billBase: 600,
      discountPercent: 10,
      discountAmount: 60,
      payableAmount: 540,
    });
  });

  it('caps appointment fee credit at quoted amount', () => {
    const quote = computeWpayDiscountQuote(500, 10, { appointmentFeeCredit: 900 });
    expect(quote.appointmentFeeCredit).toBe(500);
    expect(quote.billBase).toBe(0);
    expect(quote.discountAmount).toBe(0);
    expect(quote.payableAmount).toBe(0.01);
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
