import {
  computeWalletBookingSplit,
  resolveBookingFinancialDiscountBuckets,
  resolveLockedBookingGrossFromNotes,
} from '../booking-financial-gross';

describe('resolveBookingFinancialDiscountBuckets', () => {
  it('persists a platform coupon once when the legacy resolver shape also reports a platform discount', () => {
    expect(
      resolveBookingFinancialDiscountBuckets({
        winningPromotionType: 'coupon',
        resolvedTotalSavings: 1,
        resolvedPlatformDiscount: 1,
        clientPlatformDiscount: 0,
        clientCouponDiscount: 1,
      })
    ).toEqual({
      vendorDiscount: 0,
      platformDiscount: 0,
      couponDiscount: 1,
    });
  });
});

describe('resolveLockedBookingGrossFromNotes', () => {
  it('rebuilds all-in from servicePrice when settlement meta dropped subtotalAfterDiscounts', () => {
    const notes =
      'wp_financial_meta:{"servicePrice":10,"vendorDiscount":0,"platformDiscount":1,"couponDiscount":1,"totalTax":1.62,"platformFee":0,"walletAmount":9,"finalPaid":10.62}';
    const locked = resolveLockedBookingGrossFromNotes(notes);
    expect(locked).not.toBeNull();
    expect(locked!.subtotalAfterDiscounts).toBe(9);
    expect(locked!.grossTotal).toBe(10.62);
    expect(locked!.source).toBe('components');
    const split = computeWalletBookingSplit({
      grossTotal: locked!.grossTotal,
      walletIntent: locked!.walletAmount,
      walletBalance: 370.2,
      gstAmount: locked!.totalTax,
    });
    expect(split.walletApplied).toBe(9);
    expect(split.cashRemainder).toBe(1.62);
  });

  it('uses finalPaid + walletAmount when tax/fees alone are present with cash finalPaid', () => {
    const notes =
      'wp_financial_meta:{"subtotalAfterDiscounts":0,"totalTax":359.82,"platformFee":40,"convenienceFee":0,"deliveryFee":0,"walletAmount":370.2,"finalPaid":29.62}';
    const locked = resolveLockedBookingGrossFromNotes(notes);
    expect(locked).not.toBeNull();
    expect(locked!.grossTotal).toBe(399.82);
    expect(locked!.source).toBe('finalPaid_plus_wallet');
  });

  it('uses finalPaid + walletAmount for legacy cash-as-finalPaid meta', () => {
    const notes =
      'wp_financial_meta:{"walletAmount":370.2,"finalPaid":29.62}';
    const locked = resolveLockedBookingGrossFromNotes(notes);
    expect(locked!.grossTotal).toBe(399.82);
    expect(locked!.source).toBe('finalPaid_plus_wallet');
  });

  it('reads gstAuthority backend from financial meta for 0% lock lineage', () => {
    const notes =
      'wp_financial_meta:{"servicePrice":1000,"subtotalAfterDiscounts":1000,"totalTax":0,"cgst":0,"sgst":0,"igst":0,"platformFee":20,"walletAmount":0,"finalPaid":1020,"gstAuthority":"backend","isInterState":false}';
    const locked = resolveLockedBookingGrossFromNotes(notes);
    expect(locked).not.toBeNull();
    expect(locked!.gstAuthority).toBe('backend');
    expect(locked!.totalTax).toBe(0);
    expect(locked!.finalPaid).toBe(1020);
    expect(locked!.grossTotal).toBe(1020);
  });

  it('uses finalPaid alone when no wallet in meta', () => {
    const notes = 'wp_financial_meta:{"finalPaid":2124,"totalTax":324}';
    const locked = resolveLockedBookingGrossFromNotes(notes);
    expect(locked!.grossTotal).toBe(2124);
    expect(locked!.source).toBe('finalPaid_only');
    expect(locked!.gstAuthority).toBeNull();
  });

  it('treats modern all-in finalPaid as gross when wallet is a portion of it', () => {
    const notes =
      'wp_financial_meta:{"walletAmount":9,"finalPaid":10.62,"totalTax":1.62}';
    const locked = resolveLockedBookingGrossFromNotes(notes);
    expect(locked!.grossTotal).toBe(10.62);
    expect(locked!.source).toBe('finalPaid_only');
  });

  it('prefers finalPaid when persisted subtotalAfterDiscounts disagrees with coupon discount (COLLABCODE prod regression)', () => {
    const notes =
      'wp_financial_meta:{"servicePrice":1999,"vendorDiscount":0,"platformDiscount":0,"couponDiscount":1999,"subtotalAfterDiscounts":1999,"cgst":0,"sgst":0,"igst":0,"totalTax":0,"platformFee":40,"convenienceFee":0,"deliveryFee":0,"walletAmount":0,"finalPaid":40}';
    const locked = resolveLockedBookingGrossFromNotes(notes);
    expect(locked).not.toBeNull();
    expect(locked!.subtotalAfterDiscounts).toBe(0);
    expect(locked!.grossTotal).toBe(40);
    expect(locked!.source).toBe('components');
  });

  it('falls back to finalPaid when component gross disagrees with finalPaid', () => {
    const notes =
      'wp_financial_meta:{"servicePrice":1999,"couponDiscount":500,"subtotalAfterDiscounts":1999,"totalTax":100,"platformFee":40,"finalPaid":639}';
    const locked = resolveLockedBookingGrossFromNotes(notes);
    expect(locked).not.toBeNull();
    expect(locked!.subtotalAfterDiscounts).toBe(1499);
    expect(locked!.grossTotal).toBe(639);
    expect(locked!.source).toBe('finalPaid_only');
  });
});

describe('computeWalletBookingSplit', () => {
  it('debits intended wallet and leaves Razorpay remainder (9b0347b1 regression)', () => {
    const split = computeWalletBookingSplit({
      grossTotal: 399.82,
      walletIntent: 370.2,
      walletBalance: 370.2,
    });
    expect(split.walletApplied).toBe(370.2);
    expect(split.cashRemainder).toBe(29.62);
    expect(split.fullyWallet).toBe(false);
    expect(split.walletEligible).toBe(399.82);
  });

  it('marks fully wallet when gross is covered and GST is zero', () => {
    const split = computeWalletBookingSplit({
      grossTotal: 500,
      walletIntent: 500,
      walletBalance: 600,
    });
    expect(split.walletApplied).toBe(500);
    expect(split.cashRemainder).toBe(0);
    expect(split.fullyWallet).toBe(true);
  });

  it('excludes GST from wallet eligibility so Razorpay always collects GST', () => {
    const split = computeWalletBookingSplit({
      grossTotal: 1180,
      walletIntent: 1180,
      walletBalance: 2000,
      gstAmount: 180,
    });
    expect(split.walletEligible).toBe(1000);
    expect(split.walletApplied).toBe(1000);
    expect(split.cashRemainder).toBe(180);
    expect(split.fullyWallet).toBe(false);
  });

  it('never marks fullyWallet when GST remains even if intent covers gross', () => {
    const split = computeWalletBookingSplit({
      grossTotal: 236,
      walletIntent: 236,
      walletBalance: 236,
      gstAmount: 36,
    });
    expect(split.walletApplied).toBe(200);
    expect(split.cashRemainder).toBe(36);
    expect(split.fullyWallet).toBe(false);
  });

  it('caps gstAmount so it cannot exceed gross', () => {
    const split = computeWalletBookingSplit({
      grossTotal: 100,
      walletIntent: 100,
      walletBalance: 100,
      gstAmount: 999,
    });
    expect(split.walletEligible).toBe(0);
    expect(split.walletApplied).toBe(0);
    expect(split.cashRemainder).toBe(100);
  });
});
