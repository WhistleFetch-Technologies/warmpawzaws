import {
  computeWalletBookingSplit,
  resolveLockedBookingGrossFromNotes,
} from '../booking-financial-gross';

describe('resolveLockedBookingGrossFromNotes', () => {
  it('prefers component sum for all-in gross', () => {
    const notes =
      'wp_financial_meta:{"subtotalAfterDiscounts":0,"totalTax":359.82,"platformFee":40,"convenienceFee":0,"deliveryFee":0,"walletAmount":370.2,"finalPaid":29.62}';
    const locked = resolveLockedBookingGrossFromNotes(notes);
    expect(locked).not.toBeNull();
    expect(locked!.grossTotal).toBe(399.82);
    expect(locked!.source).toBe('components');
  });

  it('uses finalPaid + walletAmount for legacy cash-as-finalPaid meta', () => {
    const notes =
      'wp_financial_meta:{"walletAmount":370.2,"finalPaid":29.62}';
    const locked = resolveLockedBookingGrossFromNotes(notes);
    expect(locked!.grossTotal).toBe(399.82);
    expect(locked!.source).toBe('finalPaid_plus_wallet');
  });

  it('uses finalPaid alone when no wallet in meta', () => {
    const notes = 'wp_financial_meta:{"finalPaid":2124,"totalTax":324}';
    const locked = resolveLockedBookingGrossFromNotes(notes);
    expect(locked!.grossTotal).toBe(2124);
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
  });

  it('marks fully wallet when gross is covered', () => {
    const split = computeWalletBookingSplit({
      grossTotal: 500,
      walletIntent: 500,
      walletBalance: 600,
    });
    expect(split.walletApplied).toBe(500);
    expect(split.cashRemainder).toBe(0);
    expect(split.fullyWallet).toBe(true);
  });
});
