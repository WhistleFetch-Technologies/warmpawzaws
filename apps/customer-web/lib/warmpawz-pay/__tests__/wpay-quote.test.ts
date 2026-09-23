import { previewWpayCommercialQuote, previewWpayQuote } from '../wpay-quote';

describe('previewWpayQuote', () => {
  it('applies promo-engine discount on full bill', () => {
    expect(previewWpayQuote({ originalAmount: 1000, engineDiscount: 100 })).toMatchObject({
      billBase: 1000,
      discountAmount: 100,
      discountPercent: 10,
      payableAmount: 900,
      appointmentFeeCredit: 0,
    });
  });

  it('ignores appointment fee credit when provided', () => {
    expect(
      previewWpayQuote({
        originalAmount: 800,
        engineDiscount: 80,
        appointmentFeeCredit: 200,
      }),
    ).toMatchObject({
      billBase: 800,
      discountAmount: 80,
      payableAmount: 720,
      appointmentFeeCredit: 0,
    });
  });

  it('pays full bill when engine discount is missing', () => {
    expect(previewWpayQuote({ originalAmount: 1000 })).toMatchObject({
      discountAmount: 0,
      payableAmount: 1000,
    });
  });
});

describe('previewWpayCommercialQuote', () => {
  it('adds platform and convenience fees with GST on top', () => {
    expect(
      previewWpayCommercialQuote({
        originalAmount: 10_000,
        engineDiscount: 1500,
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
        engineDiscount: 10,
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
        engineDiscount: 150,
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

  it('keeps fees when there is no engine discount and overlays engine cut when present', () => {
    expect(
      previewWpayCommercialQuote({
        originalAmount: 7800,
        engineDiscount: 500,
        platformFee: 30,
        platformFeeGstRate: 18,
        convenienceFee: 20,
        convenienceGstRate: 18,
      }),
    ).toMatchObject({
      discountAmount: 500,
      servicePayableAmount: 7300,
      platformFee: 30,
      convenienceFee: 20,
      payableAmount: 7359,
    });
  });
});
