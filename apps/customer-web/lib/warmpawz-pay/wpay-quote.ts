/** Client preview — mirrors backend Pay Bill quote for UI. */
export type WpayQuotePreview = {
  originalAmount: number;
  appointmentFeeCredit: number;
  billBase: number;
  discountPercent: number;
  discountAmount: number;
  payableAmount: number;
};

export type WpayCommercialQuotePreview = {
  commercialModel: 'tier_commission';
  originalAmount: number;
  discountPercent: number;
  discountAmount: number;
  servicePayableAmount: number;
  appointmentFeeCredit: number;
  serviceDueAfterCredit: number;
  convenienceFee: number;
  convenienceGstAmount: number;
  convenienceGrossAmount: number;
  payableAmount: number;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Historical withhold model preview (discount on Q − credit). */
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

/** Tier-commission preview: C/D on full Q; credit after discount; convenience GST exclusive. */
export function previewWpayCommercialQuote(params: {
  originalAmount: number;
  discountPercent: number;
  appointmentFeeCredit?: number;
  convenienceFee?: number;
  convenienceGstRate?: number;
  maxDiscountAmount?: number | null;
}): WpayCommercialQuotePreview {
  const originalAmount = round2(params.originalAmount);
  const discountPercent = round2(params.discountPercent);

  let discountRaw = (originalAmount * discountPercent) / 100;
  if (params.maxDiscountAmount != null && discountRaw > params.maxDiscountAmount) {
    discountRaw = params.maxDiscountAmount;
  }
  const discountAmount = round2(discountRaw);
  const servicePayableAmount = round2(originalAmount - discountAmount);

  const rawCredit = params.appointmentFeeCredit ?? 0;
  const appointmentFeeCredit =
    Number.isFinite(rawCredit) && rawCredit > 0
      ? round2(Math.min(servicePayableAmount, rawCredit))
      : 0;
  const serviceDueAfterCredit = round2(Math.max(0, servicePayableAmount - appointmentFeeCredit));

  const convenienceFee = round2(Math.max(0, Number(params.convenienceFee ?? 0)));
  const convenienceGstRate = round2(Number(params.convenienceGstRate ?? 18));
  const convenienceGstAmount =
    convenienceFee > 0 && convenienceGstRate > 0
      ? round2((convenienceFee * convenienceGstRate) / 100)
      : 0;
  const convenienceGrossAmount = round2(convenienceFee + convenienceGstAmount);
  const payableAmount = Math.max(0.01, round2(serviceDueAfterCredit + convenienceGrossAmount));

  return {
    commercialModel: 'tier_commission',
    originalAmount,
    discountPercent,
    discountAmount,
    servicePayableAmount,
    appointmentFeeCredit,
    serviceDueAfterCredit,
    convenienceFee,
    convenienceGstAmount,
    convenienceGrossAmount,
    payableAmount,
  };
}
