import { isPricingCurrentlyEffective } from '../../../warmpawz-pay/shared/pricing/pricing-effective';
import type { WpayVendorListDbRow } from '../repos/wpay-vendors-list.repo';

export type WpayDiscountQuoteOptions = {
  maxDiscountAmount?: number | null;
  appointmentFeeCredit?: number;
};

export type WpayDiscountQuote = {
  /** Vendor-quoted gross bill before appointment fee credit. */
  originalAmount: number;
  /** WAPPT appointment fee applied against the quote (0 for walk-in). */
  appointmentFeeCredit: number;
  /** Amount discount % is applied to: originalAmount − appointmentFeeCredit. */
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

export function computeWpayDiscountQuote(
  originalAmount: number,
  discountPercent: number,
  options: WpayDiscountQuoteOptions | null = null,
): WpayDiscountQuote {
  const original = round2(Number(originalAmount));
  if (!Number.isFinite(original) || original <= 0) {
    throw new Error('Invalid bill amount');
  }

  const rawCredit = options?.appointmentFeeCredit ?? 0;
  const appointmentFeeCredit =
    Number.isFinite(rawCredit) && rawCredit > 0 ? round2(Math.min(original, rawCredit)) : 0;

  const billBase = round2(Math.max(0, original - appointmentFeeCredit));

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
  appointmentFeeCredit?: number;
  convenienceFee?: number;
  convenienceGstRate?: number;
  platformGstRate?: number;
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
  appointmentFeeCredit: number;
  serviceDueAfterCredit: number;
  convenienceFee: number;
  convenienceGstRate: number;
  convenienceGstAmount: number;
  convenienceGrossAmount: number;
  finalGstAmount: number;
  payNowAmount: number;
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

/** Tier-commission Pay Bill quote: C/D on full Q; credit after discount; convenience GST exclusive; platform GST inclusive in revenue. */
export function computeWpayCommercialQuote(input: WpayCommercialQuoteInput): WpayCommercialQuote {
  const quotedAmount = round2(Number(input.quotedAmount));
  if (!Number.isFinite(quotedAmount) || quotedAmount <= 0) {
    throw new WpayCommercialValidationError('Invalid bill amount');
  }

  const commissionPercent = round2(Number(input.commissionPercent));
  const discountPercent = round2(Number(input.discountPercent));
  assertDiscountBelowCommission(commissionPercent, discountPercent);

  const grossCommissionAmount = round2((quotedAmount * commissionPercent) / 100);

  let discountRaw = (quotedAmount * discountPercent) / 100;
  const maxDiscountAmount = input.maxDiscountAmount ?? null;
  if (maxDiscountAmount != null && discountRaw > maxDiscountAmount) {
    discountRaw = maxDiscountAmount;
  }
  const discountAmount = round2(discountRaw);

  const vendorPayableAmount = round2(quotedAmount - grossCommissionAmount);
  const servicePayableAmount = round2(quotedAmount - discountAmount);
  const wpayRevenueAmount = round2(grossCommissionAmount - discountAmount);

  const platformGstRate = round2(Number(input.platformGstRate ?? 18));
  const platformGstAmount =
    wpayRevenueAmount > 0 && platformGstRate > 0
      ? round2((wpayRevenueAmount * platformGstRate) / (100 + platformGstRate))
      : 0;
  const netWpayRevenueAmount = round2(Math.max(0, wpayRevenueAmount - platformGstAmount));

  const rawCredit = input.appointmentFeeCredit ?? 0;
  const appointmentFeeCredit =
    Number.isFinite(rawCredit) && rawCredit > 0
      ? round2(Math.min(servicePayableAmount, rawCredit))
      : 0;
  const serviceDueAfterCredit = round2(Math.max(0, servicePayableAmount - appointmentFeeCredit));

  const convenienceFee = round2(Math.max(0, Number(input.convenienceFee ?? 0)));
  const convenienceGstRate = round2(Number(input.convenienceGstRate ?? 18));
  const convenienceGstAmount =
    convenienceFee > 0 && convenienceGstRate > 0
      ? round2((convenienceFee * convenienceGstRate) / 100)
      : 0;
  const convenienceGrossAmount = round2(convenienceFee + convenienceGstAmount);
  const finalGstAmount = round2(platformGstAmount + convenienceGstAmount);
  const payNowAmount = Math.max(0.01, round2(serviceDueAfterCredit + convenienceGrossAmount));

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
    convenienceFee,
    convenienceGstRate,
    convenienceGstAmount,
    convenienceGrossAmount,
    finalGstAmount,
    payNowAmount,
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
    convenienceFee: quote.convenienceFee,
    convenienceGstRateSnapshot: quote.convenienceGstRate,
    convenienceGstAmount: quote.convenienceGstAmount,
    convenienceGrossAmount: quote.convenienceGrossAmount,
    finalGstAmount: quote.finalGstAmount,
    payNowAmount: quote.payNowAmount,
    ...(extras?.tierId ? { tierId: extras.tierId, tierIdSnapshot: extras.tierId } : {}),
    ...(extras?.tierName ? { tierNameSnapshot: extras.tierName } : {}),
  };
}
