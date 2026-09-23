import { debitWpayWalletFromMetadata } from '../debit-wpay-wallet';

const debitScopedWallet = jest.fn();

jest.mock('../../../../../discount-engine/promo-engine', () => ({
  debitScopedWallet: (...args: unknown[]) => debitScopedWallet(...args),
}));

describe('debitWpayWalletFromMetadata', () => {
  beforeEach(() => {
    debitScopedWallet.mockReset();
  });

  it('skips when the quote stored no wallet amount', async () => {
    const result = await debitWpayWalletFromMetadata({
      customerId: 'cust-1',
      paymentId: 'pay-1',
      vendorId: 'vendor-1',
      metadata: { quotedPayableAmount: 6200 },
    });
    expect(result).toEqual({ ok: true, skipped: true });
    expect(debitScopedWallet).not.toHaveBeenCalled();
  });

  it('debits the stored Pay Bill wallet slice', async () => {
    debitScopedWallet.mockResolvedValue({ ok: true, reused: false, debited: 50, balanceAfter: 3850 });
    const result = await debitWpayWalletFromMetadata({
      customerId: 'cust-1',
      paymentId: 'pay-1',
      vendorId: 'vendor-1',
      metadata: {
        walletAmount: 50,
        serviceCategory: 'veterinary',
        categoryId: 'cat-vet',
      },
    });
    expect(result).toEqual({ ok: true, skipped: false });
    expect(debitScopedWallet).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 'cust-1',
        amount: 50,
        vendorId: 'vendor-1',
        channel: 'paybill',
        referenceType: 'wpay',
        referenceId: 'pay-1',
      }),
    );
  });
});
