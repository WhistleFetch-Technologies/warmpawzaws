/** Client preview — mirrors backend Pay Bill quote for UI. */
export type WpayQuotePreview = {
  originalAmount: number;
  appointmentFeeCredit: number;
  billBase: number;
  discountPercent: number;
  discountAmount: number;
  payableAmount: number;
};

export type WpayFeeMode = 'fixed' | 'percent';

export type WpayCommercialQuotePreview = {
  commercialModel: 'tier_commission';
  originalAmount: number;
  discountPercent: number;
  discountAmount: number;
  servicePayableAmount: number;
  appointmentFeeCredit: number;
  serviceDueAfterCredit: number;
  platformFee: number;
  platformFeeGstAmount: number;
  platformFeeGrossAmount: number;
  convenienceFee: number;
  convenienceGstAmount: number;
  convenienceGrossAmount: number;
  payableAmount: number;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function normalizeFeeMode(mode: WpayFeeMode | undefined): WpayFeeMode {
  return mode === 'percent' ? 'percent' : 'fixed';
}

/** Resolve fee: fixed ₹, or % of post-discount amount (not original quote). */
function resolveConfiguredFeeAmount(params: {
  servicePayableAmount: number;
  configuredValue: number;
  mode?: WpayFeeMode;
}): number {
  const value = Math.max(0, Number(params.configuredValue ?? 0));
  if (!Number.isFinite(value)) return 0;
  if (normalizeFeeMode(params.mode) === 'percent') {
    return round2((params.servicePayableAmount * value) / 100);
  }
  return round2(value);
}

/** Historical withhold model preview (discount on full Q; credit ignored). */
export function previewWpayQuote(params: {
  originalAmount: number;
  discountPercent: number;
  appointmentFeeCredit?: number;
  maxDiscountAmount?: number | null;
}): WpayQuotePreview {
  const original = round2(params.originalAmount);
  const appointmentFeeCredit = 0;
  const billBase = original;

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

/** Tier-commission preview: C/D on full Q; no appointment credit; fees + exclusive GST. */
export function previewWpayCommercialQuote(params: {
  originalAmount: number;
  discountPercent: number;
  appointmentFeeCredit?: number;
  platformFee?: number;
  platformFeeMode?: WpayFeeMode;
  platformFeeGstRate?: number;
  convenienceFee?: number;
  convenienceFeeMode?: WpayFeeMode;
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

  const appointmentFeeCredit = 0;
  const serviceDueAfterCredit = servicePayableAmount;

  let platformFee = resolveConfiguredFeeAmount({
    servicePayableAmount,
    configuredValue: Number(params.platformFee ?? 0),
    mode: params.platformFeeMode,
  });
  const platformFeeGstRate = round2(Number(params.platformFeeGstRate ?? 18));
  let platformFeeGstAmount =
    platformFee > 0 && platformFeeGstRate > 0
      ? round2((platformFee * platformFeeGstRate) / 100)
      : 0;

  let convenienceFee = resolveConfiguredFeeAmount({
    servicePayableAmount,
    configuredValue: Number(params.convenienceFee ?? 0),
    mode: params.convenienceFeeMode,
  });
  const convenienceGstRate = round2(Number(params.convenienceGstRate ?? 18));
  let convenienceGstAmount =
    convenienceFee > 0 && convenienceGstRate > 0
      ? round2((convenienceFee * convenienceGstRate) / 100)
      : 0;

  const totalCustomerFees = round2(
    platformFee + platformFeeGstAmount + convenienceFee + convenienceGstAmount,
  );
  if (totalCustomerFees >= discountAmount) {
    platformFee = 0;
    platformFeeGstAmount = 0;
    convenienceFee = 0;
    convenienceGstAmount = 0;
  }

  const platformFeeGrossAmount = round2(platformFee + platformFeeGstAmount);
  const convenienceGrossAmount = round2(convenienceFee + convenienceGstAmount);
  const payableAmount = Math.max(
    0.01,
    round2(servicePayableAmount + platformFeeGrossAmount + convenienceGrossAmount),
  );

  return {
    commercialModel: 'tier_commission',
    originalAmount,
    discountPercent,
    discountAmount,
    servicePayableAmount,
    appointmentFeeCredit,
    serviceDueAfterCredit,
    platformFee,
    platformFeeGstAmount,
    platformFeeGrossAmount,
    convenienceFee,
    convenienceGstAmount,
    convenienceGrossAmount,
    payableAmount,
  };
}
