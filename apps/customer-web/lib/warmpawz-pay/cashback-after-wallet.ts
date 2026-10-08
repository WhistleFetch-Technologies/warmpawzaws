function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Same rule as the Pay Bill commit: cashback is earned on invoice minus wallet spent. */
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
