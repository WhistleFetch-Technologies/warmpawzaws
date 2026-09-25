import type { WpayVendorListDbRow } from '../repos/wpay-vendors-list.repo';

export type WpayDiscountQuoteOptions = {
  maxDiscountAmount?: number | null;
  /** Promo-engine ₹ discount (only customer cut on Pay Bill). */
  engineDiscount?: number | null;
  /** At-home WAPPT fee credited after Q−D: payNow = (Q−D)−C (+ fees on commercial). */
  appointmentFeeCredit?: number;
};

export type WpayDiscountQuote = {
  /** Vendor-quoted gross bill. */
  originalAmount: number;
  /** At-home appointment fee credited against (Q − D). */
  appointmentFeeCredit: number;
  /** Discount base remains full Q; payable is Q − D − C. */
  billBase: number;
  /** Effective % of Q from engine discount (display / history). */
  discountPercent: number;
  discountAmount: number;
  payableAmount: number;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Catalogue % is retired — Pay Bill customer cuts come only from the promo engine. */
export function resolveWpayDiscountPercent(_row: WpayVendorListDbRow): number {
  return 0;
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

/** Historical withhold model: engine discount on full Q, then at-home credit. */
export function computeWpayDiscountQuote(
  originalAmount: number,
  options: WpayDiscountQuoteOptions | null = null,
): WpayDiscountQuote {
  const original = round2(Number(originalAmount));
  if (!Number.isFinite(original) || original <= 0) {
    throw new Error('Invalid bill amount');
  }

  const billBase = original;
  const discountAmount = resolveEngineDiscountAmount(
    billBase,
    options?.engineDiscount,
    options?.maxDiscountAmount,
  );
  const afterDiscount = round2(Math.max(0, original - discountAmount));
  const rawCredit = Number(options?.appointmentFeeCredit ?? 0);
  const appointmentFeeCredit =
    Number.isFinite(rawCredit) && rawCredit > 0
      ? round2(Math.min(afterDiscount, rawCredit))
      : 0;
  const payableAmount = Math.max(0.01, round2(afterDiscount - appointmentFeeCredit));
  const discountPercent =
    original > 0 ? round2((discountAmount / original) * 100) : 0;

  return {
    originalAmount: original,
    appointmentFeeCredit,
    billBase,
    discountPercent,
    discountAmount,
    payableAmount,
  };
}

export type WpayFeeMode = 'fixed' | 'percent';

export type WpayCommercialQuoteInput = {
  quotedAmount: number;
  commissionPercent: number;
  /** At-home WAPPT fee credited after Q−D; fees still computed from Q−D. */
  appointmentFeeCredit?: number;
  /**
   * Configured platform fee value: ₹ when mode=fixed, or % of post-discount
   * customer amount (servicePayableAmount) when mode=percent.
   */
  platformFee?: number;
  platformFeeMode?: WpayFeeMode;
  platformFeeGstRate?: number;
  /**
   * Configured convenience fee value: ₹ when mode=fixed, or % of post-discount
   * customer amount when mode=percent.
   */
  convenienceFee?: number;
  convenienceFeeMode?: WpayFeeMode;
  convenienceGstRate?: number;
  /** Inclusive GST rate for platform revenue (C − D). */
  platformGstRate?: number;
  /**
   * Burn/test mode: vendor receives full Q; platform funds discount.
   * Customer pay_now and fees unchanged. Publish still requires D < C.
   */
  burnMode?: boolean;
  maxDiscountAmount?: number | null;
  /** Promo-engine ₹ discount — only customer cut (catalogue % removed). */
  engineDiscount?: number | null;
};

export type WpayCommercialQuote = {
  commercialModel: 'tier_commission';
  quotedAmount: number;
  commissionPercent: number;
  /** Effective % of Q from engine discount (display / history). */
  discountPercent: number;
  grossCommissionAmount: number;
  discountAmount: number;
  vendorPayableAmount: number;
  servicePayableAmount: number;
  wpayRevenueAmount: number;
  platformGstRate: number;
  platformGstAmount: number;
  netWpayRevenueAmount: number;
  /** At-home appointment fee credited: serviceDue = (Q−D)−C. */
  appointmentFeeCredit: number;
  /** (Q − D) − appointmentFeeCredit. */
  serviceDueAfterCredit: number;
  platformFee: number;
  platformFeeGstRate: number;
  platformFeeGstAmount: number;
  platformFeeGrossAmount: number;
  convenienceFee: number;
  convenienceGstRate: number;
  convenienceGstAmount: number;
  convenienceGrossAmount: number;
  finalGstAmount: number;
  payNowAmount: number;
  /** Snapshot: burn/test mode active for this quote. */
  burnMode: boolean;
  /** Amount platform funds when burnMode (equals discountAmount). */
  burnAmount: number;
};

export class WpayCommercialValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WpayCommercialValidationError';
  }
}

/** Tier economics: effective engine cut must stay strictly below commission ₹ (unless burn). */
export function assertEngineDiscountBelowCommission(params: {
  commissionPercent: number;
  quotedAmount: number;
  discountAmount: number;
  burnMode?: boolean;
}): void {
  const commissionPercent = round2(Number(params.commissionPercent));
  if (!Number.isFinite(commissionPercent) || commissionPercent <= 0 || commissionPercent > 100) {
    throw new WpayCommercialValidationError('Invalid commission percent');
  }
  if (params.burnMode) return;
  const quotedAmount = round2(Number(params.quotedAmount));
  const discountAmount = round2(Number(params.discountAmount));
  const grossCommissionAmount = round2((quotedAmount * commissionPercent) / 100);
  if (discountAmount + 0.009 >= grossCommissionAmount) {
    throw new WpayCommercialValidationError('Discount must be less than commission');
  }
}

/** @deprecated Prefer assertEngineDiscountBelowCommission — catalogue % removed. */
export function assertDiscountBelowCommission(
  commissionPercent: number,
  discountPercent: number,
): void {
  if (!Number.isFinite(commissionPercent) || commissionPercent <= 0 || commissionPercent > 100) {
    throw new WpayCommercialValidationError('Invalid commission percent');
  }
  if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent >= commissionPercent) {
    throw new WpayCommercialValidationError('Discount must be less than commission');
  }
}

function normalizeFeeMode(mode: WpayFeeMode | undefined): WpayFeeMode {
  return mode === 'percent' ? 'percent' : 'fixed';
}

/**
 * Resolve configured fee: fixed ₹, or % of post-discount customer amount
 * (`servicePayableAmount` = Q − discount), never % of original quote Q.
 */
export function resolveWpayConfiguredFeeAmount(params: {
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

/**
 * Tier-commission Pay Bill quote:
 * - Customer discount = promo-engine ₹ only (no catalogue %)
 * - C/D on full Q; platform revenue = C − D (GST inclusive extract) unless burnMode
 * - burnMode: vendor paid full Q; platform funds discount; fees unchanged
 * - At-home appointment credit after Q−D: payNow = (Q−D)−credit + fees
 * - Platform fee + convenience fee each with exclusive GST on top
 * - Fees may be fixed ₹ or % of post-discount amount (not after credit)
 * - Guardrail: if total fees (incl. fee GST) >= engine discount ₹, zero all fees + fee GST
 */
export function computeWpayCommercialQuote(input: WpayCommercialQuoteInput): WpayCommercialQuote {
  const quotedAmount = round2(Number(input.quotedAmount));
  if (!Number.isFinite(quotedAmount) || quotedAmount <= 0) {
    throw new WpayCommercialValidationError('Invalid bill amount');
  }

  const commissionPercent = round2(Number(input.commissionPercent));
  const burnMode = Boolean(input.burnMode);
  const grossCommissionAmount = round2((quotedAmount * commissionPercent) / 100);

  const discountAmount = resolveEngineDiscountAmount(
    quotedAmount,
    input.engineDiscount,
    input.maxDiscountAmount,
  );
  assertEngineDiscountBelowCommission({
    commissionPercent,
    quotedAmount,
    discountAmount,
    burnMode,
  });

  const servicePayableAmount = round2(quotedAmount - discountAmount);
  // Burn: vendor gets full Q; platform funds discount (no C−D margin).
  const vendorPayableAmount = burnMode
    ? quotedAmount
    : round2(quotedAmount - grossCommissionAmount);
  const wpayRevenueAmount = burnMode ? 0 : round2(grossCommissionAmount - discountAmount);

  const platformGstRate = round2(Number(input.platformGstRate ?? 18));
  const platformGstAmount =
    wpayRevenueAmount > 0 && platformGstRate > 0
      ? round2((wpayRevenueAmount * platformGstRate) / (100 + platformGstRate))
      : 0;
  const netWpayRevenueAmount = round2(Math.max(0, wpayRevenueAmount - platformGstAmount));

  const rawCredit = Number(input.appointmentFeeCredit ?? 0);
  const appointmentFeeCredit =
    Number.isFinite(rawCredit) && rawCredit > 0
      ? round2(Math.min(servicePayableAmount, rawCredit))
      : 0;
  const serviceDueAfterCredit = round2(Math.max(0, servicePayableAmount - appointmentFeeCredit));

  let platformFee = resolveWpayConfiguredFeeAmount({
    servicePayableAmount,
    configuredValue: Number(input.platformFee ?? 0),
    mode: input.platformFeeMode,
  });
  const platformFeeGstRate = round2(Number(input.platformFeeGstRate ?? 18));
  let platformFeeGstAmount =
    platformFee > 0 && platformFeeGstRate > 0
      ? round2((platformFee * platformFeeGstRate) / 100)
      : 0;

  let convenienceFee = resolveWpayConfiguredFeeAmount({
    servicePayableAmount,
    configuredValue: Number(input.convenienceFee ?? 0),
    mode: input.convenienceFeeMode,
  });
  const convenienceGstRate = round2(Number(input.convenienceGstRate ?? 18));
  let convenienceGstAmount =
    convenienceFee > 0 && convenienceGstRate > 0
      ? round2((convenienceFee * convenienceGstRate) / 100)
      : 0;

  const totalCustomerFees = round2(
    platformFee + platformFeeGstAmount + convenienceFee + convenienceGstAmount,
  );
  // Fees must stay strictly below the promo-engine discount; otherwise wipe fees.
  if (discountAmount > 0.009 && totalCustomerFees >= discountAmount) {
    platformFee = 0;
    platformFeeGstAmount = 0;
    convenienceFee = 0;
    convenienceGstAmount = 0;
  }

  const platformFeeGrossAmount = round2(platformFee + platformFeeGstAmount);
  const convenienceGrossAmount = round2(convenienceFee + convenienceGstAmount);

  const finalGstAmount = round2(platformGstAmount + platformFeeGstAmount + convenienceGstAmount);
  const payNowAmount = Math.max(
    0.01,
    round2(serviceDueAfterCredit + platformFeeGrossAmount + convenienceGrossAmount),
  );
  // Burn amount = vendor payable − customer paid (payNow).
  const burnAmount = burnMode
    ? round2(Math.max(0, vendorPayableAmount - payNowAmount))
    : 0;

  return {
    commercialModel: 'tier_commission',
    quotedAmount,
    commissionPercent,
    discountPercent:
      quotedAmount > 0 ? round2((discountAmount / quotedAmount) * 100) : 0,
    grossCommissionAmount,
    discountAmount,
    vendorPayableAmount,
    servicePayableAmount,
    wpayRevenueAmount,
    platformGstRate,
    platformGstAmount,
    netWpayRevenueAmount,
    appointmentFeeCredit,
    serviceDueAfterCredit,
    platformFee,
    platformFeeGstRate,
    platformFeeGstAmount,
    platformFeeGrossAmount,
    convenienceFee,
    convenienceGstRate,
    convenienceGstAmount,
    convenienceGrossAmount,
    finalGstAmount,
    payNowAmount,
    burnMode,
    burnAmount,
  };
}

export function buildWpayCommercialSnapshot(quote: WpayCommercialQuote, extras?: {
  tierId?: string | null;
  tierName?: string | null;
}): Record<string, unknown> {
  return {
    commercialModel: quote.commercialModel,
    quotedAmount: quote.quotedAmount,
    quotedOriginalAmount: quote.quotedAmount,
    quotedDiscountAmount: quote.discountAmount,
    quotedDiscountPercent: quote.discountPercent,
    commissionPercentSnapshot: quote.commissionPercent,
    grossCommissionAmount: quote.grossCommissionAmount,
    vendorPayableAmount: quote.vendorPayableAmount,
    servicePayableAmount: quote.servicePayableAmount,
    wpayRevenueAmount: quote.wpayRevenueAmount,
    platformGstRateSnapshot: quote.platformGstRate,
    platformGstAmount: quote.platformGstAmount,
    netWpayRevenueAmount: quote.netWpayRevenueAmount,
    appointmentFeeCredit: quote.appointmentFeeCredit,
    serviceDueAfterCredit: quote.serviceDueAfterCredit,
    platformFee: quote.platformFee,
    platformFeeGstRateSnapshot: quote.platformFeeGstRate,
    platformFeeGstAmount: quote.platformFeeGstAmount,
    platformFeeGrossAmount: quote.platformFeeGrossAmount,
    convenienceFee: quote.convenienceFee,
    convenienceGstRateSnapshot: quote.convenienceGstRate,
    convenienceGstAmount: quote.convenienceGstAmount,
    convenienceGrossAmount: quote.convenienceGrossAmount,
    finalGstAmount: quote.finalGstAmount,
    payNowAmount: quote.payNowAmount,
    burnMode: quote.burnMode,
    burnAmount: quote.burnAmount,
    ...(extras?.tierId ? { tierId: extras.tierId, tierIdSnapshot: extras.tierId } : {}),
    ...(extras?.tierName ? { tierNameSnapshot: extras.tierName } : {}),
  };
}
