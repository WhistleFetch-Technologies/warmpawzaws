import { cashbackAfterWalletSpend } from '../cashback-after-wallet';

describe('cashbackAfterWalletSpend', () => {
  it('leaves cashback on the full invoice when no wallet is used', () => {
    expect(cashbackAfterWalletSpend(10, 1000, 0)).toBe(10);
  });

  it('drops the 1% that would have been earned on wallet already spent', () => {
    // ₹1,000 invoice, ₹10 quoted (1%), ₹200 old wallet → earn on ₹800.
    expect(cashbackAfterWalletSpend(10, 1000, 200)).toBe(8);
  });

  it('earns nothing when the whole invoice is paid from wallet', () => {
    expect(cashbackAfterWalletSpend(10, 1000, 1000)).toBe(0);
  });

  it('does not increase cashback', () => {
    expect(cashbackAfterWalletSpend(10, 1000, -50)).toBe(10);
  });
});
