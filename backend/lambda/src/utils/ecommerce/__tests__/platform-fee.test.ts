import { computeEcommercePlatformFee, readStoredEcommercePlatformFee } from '../platform-fee';

describe('computeEcommercePlatformFee', () => {
  it('adds GST on top of a fixed fee', () => {
    expect(
      computeEcommercePlatformFee({
        subtotalAfterDiscount: 1983,
        platformFee: 20,
        platformFeeMode: 'fixed',
        platformFeeGstRate: 18,
      }),
    ).toEqual({
      platformFee: 20,
      platformFeeMode: 'fixed',
      platformFeeGstRate: 18,
      platformFeeGstAmount: 3.6,
      platformFeeGross: 23.6,
    });
  });

  it('takes a percent of the post-discount cart, then adds GST', () => {
    expect(
      computeEcommercePlatformFee({
        subtotalAfterDiscount: 1000,
        platformFee: 2,
        platformFeeMode: 'percent',
        platformFeeGstRate: 18,
      }),
    ).toMatchObject({
      platformFee: 20,
      platformFeeGstAmount: 3.6,
      platformFeeGross: 23.6,
    });
  });

  it('keeps the fee when it is smaller than the promo discount', () => {
    expect(
      computeEcommercePlatformFee({
        subtotalAfterDiscount: 900,
        discountAmount: 100,
        platformFee: 20,
        platformFeeMode: 'fixed',
        platformFeeGstRate: 18,
      }),
    ).toMatchObject({
      platformFee: 20,
      platformFeeGstAmount: 3.6,
      platformFeeGross: 23.6,
    });
  });

  it('drops the fee and its GST when they are at least the promo discount', () => {
    expect(
      computeEcommercePlatformFee({
        subtotalAfterDiscount: 980,
        discountAmount: 20,
        platformFee: 20,
        platformFeeMode: 'fixed',
        platformFeeGstRate: 18,
      }),
    ).toMatchObject({
      platformFee: 0,
      platformFeeGstAmount: 0,
      platformFeeGross: 0,
      platformFeeGstRate: 18,
    });
  });

  it('keeps the fee when there is no promo discount', () => {
    expect(
      computeEcommercePlatformFee({
        subtotalAfterDiscount: 1000,
        discountAmount: 0,
        platformFee: 20,
        platformFeeMode: 'fixed',
        platformFeeGstRate: 18,
      }).platformFeeGross,
    ).toBe(23.6);
  });

  it('charges nothing when the admin fee is zero', () => {
    expect(
      computeEcommercePlatformFee({
        subtotalAfterDiscount: 500,
        platformFee: 0,
        platformFeeMode: 'fixed',
        platformFeeGstRate: 18,
      }).platformFeeGross,
    ).toBe(0);
  });

  it('reads the stored checkout snapshot', () => {
    expect(
      readStoredEcommercePlatformFee({
        checkoutSnapshot: { platform_fee: 20, platform_fee_gst_amount: 3.6 },
      }),
    ).toEqual({ platformFee: 20, platformFeeGstAmount: 3.6 });
  });
});
