/** Client preview — mirrors backend computeWpayDiscountQuote for Pay Bill UI. */
export type WpayQuotePreview = {
  originalAmount: number;
  appointmentFeeCredit: number;
  billBase: number;
  discountPercent: number;
  discountAmount: number;
  payableAmount: number;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function previewWpayQuote(params: {
  originalAmount: number;
  discountPercent: number;
  appointmentFeeCredit?: number;
  maxDiscountAmount?: number | null;
}): WpayQuotePreview {
  const original = round2(params.originalAmount);
  const rawCredit = params.appointmentFeeCredit ?? 0;
  const appointmentFeeCredit =
    Number.isFinite(rawCredit) && rawCredit > 0 ? round2(Math.min(original, rawCredit)) : 0;
  const billBase = round2(Math.max(0, original - appointmentFeeCredit));

  let discountRaw = (billBase * params.discountPercent) / 100;
  if (params.maxDiscountAmount != null && discountRaw > params.maxDiscountAmount) {
    discountRaw = params.maxDiscountAmount;
  }
  const discountAmount = round2(discountRaw);
  const payableAmount = Math.max(0.01, round2(billBase - discountAmount));

  return {
    originalAmount: original,
    appointmentFeeCredit,
    billBase,
    discountPercent: params.discountPercent,
    discountAmount,
    payableAmount,
  };
}
