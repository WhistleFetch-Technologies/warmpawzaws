function roundMoney(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
}

/**
 * Wallet debits and wallet `payments` rows often represent the same money (wallet-only bookings).
 * Only add wallet debits not already captured in completed payment rows (split-pay gateway remainder).
 */
export function combineWalletAndPaymentRefundable(
  refundableFromPayments: number,
  walletDebitTotal: number,
  walletCapturedInPayments: number
): number {
  const walletExtra = Math.max(0, walletDebitTotal - walletCapturedInPayments);
  return roundMoney(refundableFromPayments + walletExtra);
}
