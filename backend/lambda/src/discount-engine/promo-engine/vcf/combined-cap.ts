/**
 * When discount and cashback are both on, maxDiscount is the ceiling on the two combined.
 * Instant cut is kept first; cashback is reduced, then discount if still over.
 */
export function applyCombinedCap(opts: {
  discount: number;
  cashback: number;
  maxDiscount?: number | null;
  billAmount: number;
}): { discount: number; cashback: number } {
  const bill = Math.max(0, Number(opts.billAmount) || 0);
  let discount = Math.min(Math.max(0, Number(opts.discount) || 0), bill);
  let cashback = Math.max(0, Number(opts.cashback) || 0);
  const cap = opts.maxDiscount;
  if (cap == null || !Number.isFinite(cap) || cap <= 0) {
    return {
      discount: Math.round(discount * 100) / 100,
      cashback: Math.round(cashback * 100) / 100,
    };
  }

  if (discount > cap) {
    discount = cap;
    cashback = 0;
  } else if (discount + cashback > cap) {
    cashback = cap - discount;
  }

  return {
    discount: Math.round(discount * 100) / 100,
    cashback: Math.round(Math.max(0, cashback) * 100) / 100,
  };
}
