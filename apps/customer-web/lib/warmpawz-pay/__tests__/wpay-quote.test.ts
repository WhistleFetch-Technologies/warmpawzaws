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

  it('applies percent fees on post-discount amount and zeros fees when they exhaust discount', () => {
    expect(
      previewWpayCommercialQuote({
        originalAmount: 100,
        discountPercent: 10,
        platformFee: 8,
        platformFeeMode: 'fixed',
        platformFeeGstRate: 18,
        convenienceFee: 2,
        convenienceFeeMode: 'fixed',
        convenienceGstRate: 18,
      }),
    ).toMatchObject({
      discountAmount: 10,
      platformFee: 0,
      convenienceFee: 0,
      payableAmount: 90,
    });

    expect(
      previewWpayCommercialQuote({
        originalAmount: 1000,
        discountPercent: 15,
        platformFee: 2,
        platformFeeMode: 'percent',
        platformFeeGstRate: 0,
        convenienceFee: 1,
        convenienceFeeMode: 'percent',
        convenienceGstRate: 0,
      }),
    ).toMatchObject({
      servicePayableAmount: 850,
      platformFee: 17,
      convenienceFee: 8.5,
      payableAmount: 875.5,
    });
  });
});
