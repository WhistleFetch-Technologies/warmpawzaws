/** Client preview — mirrors backend Pay Bill quote for UI. */
export type WpayQuotePreview = {
  originalAmount: number;
  appointmentFeeCredit: number;
  billBase: number;
  /** Effective % of Q from engine discount (display). */
  discountPercent: number;
  discountAmount: number;
  payableAmount: number;
};

export type WpayFeeMode = 'fixed' | 'percent';

export type WpayCommercialQuotePreview = {
  commercialModel: 'tier_commission';
  originalAmount: number;
  /** Effective % of Q from engine discount (display). */
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

function resolveEngineDiscountAmount(
  quotedAmount: number,
  engineDiscount: number | null | undefined,
  maxDiscountAmount?: number | null,
): number {
  let discountRaw = Math.max(0, round2(Number(engineDiscount ?? 0) || 0));
  if (maxDiscountAmount != null && discountRaw > maxDiscountAmount) {
    discountRaw = maxDiscountAmount;
  }
  return round2(Math.min(discountRaw, Math.max(0, quotedAmount - 0.01)));
}

/** Historical withhold model preview — promo-engine ₹ on Q, then at-home credit. */
export function previewWpayQuote(params: {
  originalAmount: number;
  appointmentFeeCredit?: number;
  maxDiscountAmount?: number | null;
  engineDiscount?: number | null;
}): WpayQuotePreview {
  const original = round2(params.originalAmount);
  const billBase = original;
  const discountAmount = resolveEngineDiscountAmount(
    billBase,
    params.engineDiscount,
    params.maxDiscountAmount,
  );
  const afterDiscount = round2(Math.max(0, original - discountAmount));
  const rawCredit = Number(params.appointmentFeeCredit ?? 0);
  const appointmentFeeCredit =
    Number.isFinite(rawCredit) && rawCredit > 0
      ? round2(Math.min(afterDiscount, rawCredit))
      : 0;
  const payableAmount = Math.max(0.01, round2(afterDiscount - appointmentFeeCredit));

  return {
    originalAmount: original,
    appointmentFeeCredit,
    billBase,
    discountPercent: original > 0 ? round2((discountAmount / original) * 100) : 0,
    discountAmount,
    payableAmount,
  };
}

/**
 * Tier-commission preview: engine discount on Q, then at-home credit, then fees.
 * Fees computed from (Q − D). Guardrail: fees wiped when total fees >= engine discount ₹.
 */
export function previewWpayCommercialQuote(params: {
  originalAmount: number;
  appointmentFeeCredit?: number;
  platformFee?: number;
  platformFeeMode?: WpayFeeMode;
  platformFeeGstRate?: number;
  convenienceFee?: number;
  convenienceFeeMode?: WpayFeeMode;
  convenienceGstRate?: number;
  maxDiscountAmount?: number | null;
  engineDiscount?: number | null;
}): WpayCommercialQuotePreview {
  const originalAmount = round2(params.originalAmount);
  const discountAmount = resolveEngineDiscountAmount(
    originalAmount,
    params.engineDiscount,
    params.maxDiscountAmount,
  );
  const servicePayableAmount = round2(originalAmount - discountAmount);

  const rawCredit = Number(params.appointmentFeeCredit ?? 0);
  const appointmentFeeCredit =
    Number.isFinite(rawCredit) && rawCredit > 0
      ? round2(Math.min(servicePayableAmount, rawCredit))
      : 0;
  const serviceDueAfterCredit = round2(Math.max(0, servicePayableAmount - appointmentFeeCredit));

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
  if (discountAmount > 0.009 && totalCustomerFees >= discountAmount) {
    platformFee = 0;
    platformFeeGstAmount = 0;
    convenienceFee = 0;
    convenienceGstAmount = 0;
  }

  const platformFeeGrossAmount = round2(platformFee + platformFeeGstAmount);
  const convenienceGrossAmount = round2(convenienceFee + convenienceGstAmount);
  const payableAmount = Math.max(
    0.01,
    round2(serviceDueAfterCredit + platformFeeGrossAmount + convenienceGrossAmount),
  );

  return {
    commercialModel: 'tier_commission',
    originalAmount,
    discountPercent:
      originalAmount > 0 ? round2((discountAmount / originalAmount) * 100) : 0,
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
