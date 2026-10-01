/**
 * maxDiscount caps the instant discount only. Cashback is never reduced by it.
 */
export function applyDiscountCap(opts: {
  discount: number;
  cashback: number;
  maxDiscount?: number | null;
  billAmount: number;
}): { discount: number; cashback: number } {
  const bill = Math.max(0, Number(opts.billAmount) || 0);
  let discount = Math.min(Math.max(0, Number(opts.discount) || 0), bill);
  const cashback = Math.max(0, Number(opts.cashback) || 0);
  const cap = opts.maxDiscount;
  if (cap != null && Number.isFinite(cap) && cap > 0 && discount > cap) {
    discount = cap;
  }

  return {
    discount: Math.round(discount * 100) / 100,
    cashback: Math.round(cashback * 100) / 100,
  };
}
