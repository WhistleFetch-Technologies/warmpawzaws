import { capWpayWalletAmount } from '../../../../endpoints/customer/warmpawz-pay/shared/wpay-wallet';

describe('capWpayWalletAmount', () => {
  it('caps to spendable and payable', () => {
    expect(capWpayWalletAmount({ payable: 500, requested: 400, spendable: 50 })).toEqual({
      walletAmount: 50,
      razorpayAmount: 450,
      walletOnly: false,
    });
  });

  it('keeps at least ₹1 on Razorpay when cash remainder would be under the min charge', () => {
    expect(capWpayWalletAmount({ payable: 100, requested: 99.5, spendable: 100 })).toEqual({
      walletAmount: 99,
      razorpayAmount: 1,
      walletOnly: false,
    });
  });

  it('allows a full wallet cover', () => {
    expect(capWpayWalletAmount({ payable: 80, requested: 80, spendable: 80 })).toEqual({
      walletAmount: 80,
      razorpayAmount: 0,
      walletOnly: true,
    });
  });
});
