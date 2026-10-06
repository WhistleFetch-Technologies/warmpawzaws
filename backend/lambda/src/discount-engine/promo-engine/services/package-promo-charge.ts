function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

/**
 * Instant promo discount on a package purchase.
 * The cut comes off the pre-GST base. GST stays due, so the charge never drops below GST.
 */
export function packageChargeAfterPromo(opts: {
  grossTotal: number;
  basePrice: number;
  gstAmount: number;
  engineDiscount: number;
}): { discount: number; chargeGross: number } {
  const base = roundMoney(Math.max(0, opts.basePrice));
  const gst = roundMoney(Math.max(0, opts.gstAmount));
  const gross = roundMoney(Math.max(0, opts.grossTotal));
  const discount = roundMoney(Math.min(Math.max(0, opts.engineDiscount), base));
  const chargeGross = roundMoney(Math.max(gst, gross - discount));
  return { discount, chargeGross };
}
