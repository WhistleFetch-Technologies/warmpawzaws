import { previewWpayCommercialQuote, previewWpayQuote } from '../wpay-quote';

describe('previewWpayQuote', () => {
  it('applies discount on full bill (appointment credit ignored)', () => {
    expect(previewWpayQuote({ originalAmount: 1000, discountPercent: 10 })).toMatchObject({
      billBase: 1000,
      discountAmount: 100,
      payableAmount: 900,
      appointmentFeeCredit: 0,
    });
  });

  it('ignores appointment fee credit when provided', () => {
    expect(
      previewWpayQuote({ originalAmount: 800, discountPercent: 10, appointmentFeeCredit: 200 }),
    ).toMatchObject({
      billBase: 800,
      discountAmount: 80,
      payableAmount: 720,
      appointmentFeeCredit: 0,
    });
  });
});

describe('previewWpayCommercialQuote', () => {
  it('adds platform and convenience fees with GST on top', () => {
    expect(
      previewWpayCommercialQuote({
        originalAmount: 10_000,
        discountPercent: 15,
        platformFee: 30,
        platformFeeGstRate: 18,
        convenienceFee: 20,
        convenienceGstRate: 18,
      }),
    ).toMatchObject({
      servicePayableAmount: 8500,
      platformFeeGstAmount: 5.4,
      convenienceGstAmount: 3.6,
      payableAmount: 8559,
      appointmentFeeCredit: 0,
    });
  });
});
