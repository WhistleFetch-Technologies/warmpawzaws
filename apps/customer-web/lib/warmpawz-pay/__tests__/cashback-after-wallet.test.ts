import { cashbackAfterWalletSpend } from '../cashback-after-wallet';

describe('cashbackAfterWalletSpend', () => {
  it('earns 1% on the invoice minus wallet already applied', () => {
    expect(cashbackAfterWalletSpend(10, 1000, 200)).toBe(8);
    expect(cashbackAfterWalletSpend(10, 1000, 0)).toBe(10);
  });
});
