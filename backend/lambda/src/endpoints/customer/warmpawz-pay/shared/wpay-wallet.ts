function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Razorpay India standard checkout minimum. */
const RAZORPAY_MIN_RUPEES = 1;

/**
 * Cap a Pay Bill wallet request: spendable + redeem-scope already applied by caller.
 * Leaves ₹1 on Razorpay unless wallet covers the whole payable.
 */
export function capWpayWalletAmount(params: {
  payable: number;
  requested: number;
  spendable: number;
}): { walletAmount: number; razorpayAmount: number; walletOnly: boolean } {
  const payable = round2(Math.max(0, params.payable));
  const requested = round2(Math.max(0, params.requested));
  const spendable = round2(Math.max(0, params.spendable));
  let walletAmount = round2(Math.min(requested, spendable, payable));
  let razorpayAmount = round2(Math.max(0, payable - walletAmount));
  if (razorpayAmount > 0 && razorpayAmount < RAZORPAY_MIN_RUPEES) {
    walletAmount = round2(Math.max(0, payable - RAZORPAY_MIN_RUPEES));
    razorpayAmount = round2(Math.max(0, payable - walletAmount));
  }
  return {
    walletAmount,
    razorpayAmount,
    walletOnly: razorpayAmount < 0.01 && walletAmount > 0.009,
  };
}
