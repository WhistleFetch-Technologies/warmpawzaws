import { isPricingCurrentlyEffective } from '../../../warmpawz-pay/shared/pricing/pricing-effective';
import type { WpayVendorListDbRow } from '../repos/wpay-vendors-list.repo';

export type WpayDiscountQuoteOptions = {
  maxDiscountAmount?: number | null;
  /** @deprecated Appointment credit is unwired for Pay Bill; ignored. */
  appointmentFeeCredit?: number;
};

export type WpayDiscountQuote = {
  /** Vendor-quoted gross bill. */
  originalAmount: number;
  /** Always 0 — appointment credit is unwired from Pay Bill. */
  appointmentFeeCredit: number;
  /** Same as originalAmount (credit no longer reduces bill base). */
  billBase: number;
  discountPercent: number;
  discountAmount: number;
  payableAmount: number;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function resolveWpayDiscountPercent(row: WpayVendorListDbRow): number {
  const value = row.pricing_discount_value != null ? Number(row.pricing_discount_value) : 0;
  const effective = isPricingCurrentlyEffective({
    status: String(row.pricing_status ?? 'disabled') as 'active' | 'disabled',
    effectiveFrom: row.pricing_effective_from ? new Date(row.pricing_effective_from) : new Date(0),
    effectiveUntil: row.pricing_effective_until ? new Date(row.pricing_effective_until) : null,
    discountValue: Number.isFinite(value) ? value : 0,
  });
  return effective && Number.isFinite(value) ? round2(value) : 0;
}

/** Historical withhold model: discount on full Q (appointment credit ignored). */
export function computeWpayDiscountQuote(
  originalAmount: number,
  discountPercent: number,
  options: WpayDiscountQuoteOptions | null = null,
): WpayDiscountQuote {
  const original = round2(Number(originalAmount));
  if (!Number.isFinite(original) || original <= 0) {
    throw new Error('Invalid bill amount');
  }

  const appointmentFeeCredit = 0;
  const billBase = original;

  let discountRaw = (billBase * discountPercent) / 100;
  const maxDiscountAmount = options?.maxDiscountAmount ?? null;
  if (maxDiscountAmount != null && discountRaw > maxDiscountAmount) {
    discountRaw = maxDiscountAmount;
  }
  const discountAmount = round2(discountRaw);
  const payableAmount = Math.max(0.01, round2(billBase - discountAmount));

  return {
    originalAmount: original,
    appointmentFeeCredit,
    billBase,
    discountPercent,
    discountAmount,
    payableAmount,
  };
}

export type WpayCommercialQuoteInput = {
  quotedAmount: number;
  commissionPercent: number;
  discountPercent: number;
  /** @deprecated Ignored — appointment credit unwired from Pay Bill. */
  appointmentFeeCredit?: number;
  platformFee?: number;
  platformFeeGstRate?: number;
  convenienceFee?: number;
  convenienceGstRate?: number;
  /** Inclusive GST rate for platform revenue (C − D). */
  platformGstRate?: number;
  /**
   * Burn/test mode: vendor receives full Q; platform funds discount.
   * Customer pay_now and fees unchanged. Publish still requires D < C.
   */
  burnMode?: boolean;
  maxDiscountAmount?: number | null;
};

export type WpayCommercialQuote = {
  commercialModel: 'tier_commission';
  quotedAmount: number;
  commissionPercent: number;
  discountPercent: number;
  grossCommissionAmount: number;
  discountAmount: number;
  vendorPayableAmount: number;
  servicePayableAmount: number;
  wpayRevenueAmount: number;
  platformGstRate: number;
  platformGstAmount: number;
  netWpayRevenueAmount: number;
  /** Always 0 — appointment credit unwired. */
  appointmentFeeCredit: number;
  /** Alias of servicePayableAmount (credit removed). */
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

/**
 * Tier-commission Pay Bill quote:
 * - C/D on full Q; platform revenue = C − D (GST inclusive extract) unless burnMode
 * - burnMode: vendor paid full Q; platform funds discount; fees unchanged
 * - No appointment credit
 * - Platform fee + convenience fee each with exclusive GST on top
 */
export function computeWpayCommercialQuote(input: WpayCommercialQuoteInput): WpayCommercialQuote {
  const quotedAmount = round2(Number(input.quotedAmount));
  if (!Number.isFinite(quotedAmount) || quotedAmount <= 0) {
    throw new WpayCommercialValidationError('Invalid bill amount');
  }

  const commissionPercent = round2(Number(input.commissionPercent));
  const discountPercent = round2(Number(input.discountPercent));
  assertDiscountBelowCommission(commissionPercent, discountPercent);

  const burnMode = Boolean(input.burnMode);
  const grossCommissionAmount = round2((quotedAmount * commissionPercent) / 100);

  let discountRaw = (quotedAmount * discountPercent) / 100;
  const maxDiscountAmount = input.maxDiscountAmount ?? null;
  if (maxDiscountAmount != null && discountRaw > maxDiscountAmount) {
    discountRaw = maxDiscountAmount;
  }
  const discountAmount = round2(discountRaw);

  const servicePayableAmount = round2(quotedAmount - discountAmount);
  // Burn: vendor gets full Q; platform funds discount (no C−D margin).
  const vendorPayableAmount = burnMode
    ? quotedAmount
    : round2(quotedAmount - grossCommissionAmount);
  const wpayRevenueAmount = burnMode ? 0 : round2(grossCommissionAmount - discountAmount);
  const burnAmount = burnMode ? discountAmount : 0;

  const platformGstRate = round2(Number(input.platformGstRate ?? 18));
  const platformGstAmount =
    wpayRevenueAmount > 0 && platformGstRate > 0
      ? round2((wpayRevenueAmount * platformGstRate) / (100 + platformGstRate))
      : 0;
  const netWpayRevenueAmount = round2(Math.max(0, wpayRevenueAmount - platformGstAmount));

  const appointmentFeeCredit = 0;
  const serviceDueAfterCredit = servicePayableAmount;

  const platformFee = round2(Math.max(0, Number(input.platformFee ?? 0)));
  const platformFeeGstRate = round2(Number(input.platformFeeGstRate ?? 18));
  const platformFeeGstAmount =
    platformFee > 0 && platformFeeGstRate > 0
      ? round2((platformFee * platformFeeGstRate) / 100)
      : 0;
  const platformFeeGrossAmount = round2(platformFee + platformFeeGstAmount);

  const convenienceFee = round2(Math.max(0, Number(input.convenienceFee ?? 0)));
  const convenienceGstRate = round2(Number(input.convenienceGstRate ?? 18));
  const convenienceGstAmount =
    convenienceFee > 0 && convenienceGstRate > 0
      ? round2((convenienceFee * convenienceGstRate) / 100)
      : 0;
  const convenienceGrossAmount = round2(convenienceFee + convenienceGstAmount);

  const finalGstAmount = round2(platformGstAmount + platformFeeGstAmount + convenienceGstAmount);
  const payNowAmount = Math.max(
    0.01,
    round2(servicePayableAmount + platformFeeGrossAmount + convenienceGrossAmount),
  );

  return {
    commercialModel: 'tier_commission',
    quotedAmount,
    commissionPercent,
    discountPercent,
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
    appointmentFeeCredit: 0,
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
