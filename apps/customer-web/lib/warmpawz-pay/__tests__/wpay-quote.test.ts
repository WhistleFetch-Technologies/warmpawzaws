import { previewWpayQuote } from '../wpay-quote';

describe('previewWpayQuote', () => {
  it('applies discount on full bill when no appointment credit', () => {
    expect(previewWpayQuote({ originalAmount: 1000, discountPercent: 10 })).toMatchObject({
      billBase: 1000,
      discountAmount: 100,
      payableAmount: 900,
    });
  });

  it('deducts appointment fee before discount', () => {
    expect(
      previewWpayQuote({ originalAmount: 800, discountPercent: 10, appointmentFeeCredit: 200 }),
    ).toMatchObject({
      billBase: 600,
      discountAmount: 60,
      payableAmount: 540,
    });
  });
});
