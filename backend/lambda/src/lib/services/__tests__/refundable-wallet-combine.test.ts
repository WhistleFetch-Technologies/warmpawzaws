import { describe, expect, it } from '@jest/globals';
import { combineWalletAndPaymentRefundable } from '../refundable-wallet-combine';

describe('combineWalletAndPaymentRefundable', () => {
  it('does not double-count wallet-only bookings (payment row + wallet debit)', () => {
    expect(combineWalletAndPaymentRefundable(500, 500, 500)).toBe(500);
  });

  it('adds split-pay wallet debits not captured in payment rows', () => {
    expect(combineWalletAndPaymentRefundable(280, 200, 0)).toBe(480);
  });

  it('uses payment refundable base when only gateway paid', () => {
    expect(combineWalletAndPaymentRefundable(450, 0, 0)).toBe(450);
  });

  it('ignores wallet debits beyond wallet payment rows when partially overlapping', () => {
    expect(combineWalletAndPaymentRefundable(300, 200, 150)).toBe(350);
  });
});
