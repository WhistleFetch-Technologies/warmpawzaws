function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Cashback is earned on the invoice minus wallet spent on this payment.
 * The instant discount stays on the full invoice; only cashback shrinks.
 * Wallet of 0 leaves the quoted cashback unchanged.
 */
export function cashbackAfterWalletSpend(
  quotedCashback: number,
  invoice: number,
  walletUsed: number,
): number {
  const quoted = Math.max(0, Number(quotedCashback) || 0);
  const bill = Number(invoice);
  const wallet = Number(walletUsed);
  if (!(quoted > 0) || !Number.isFinite(bill) || bill <= 0 || !Number.isFinite(wallet) || wallet <= 0.009) {
    return round2(quoted);
  }
  const earnBase = Math.max(0, bill - wallet);
  return round2(quoted * (earnBase / bill));
}
