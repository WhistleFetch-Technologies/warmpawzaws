import { getBenefitCalculator } from '../benefit-calculator';
import { resolveDiscountWithLegacyFallback } from '../compare';
import type { BenefitContext } from '../types';
import {
  COMBO_BENEFIT_TYPE,
  FLAT_BENEFIT_TYPE,
  LOYALTY_BENEFIT_TYPE,
  PERCENTAGE_BENEFIT_TYPE,
} from '../strategies';

export function computeServiceStandardDiscountAmount(params: {
  discountType: string;
  discountValue: number;
  bookingAmount: number;
  maxDiscountAmount?: number | null;
  legacyAmount: number;
}): number {
  const ctx: BenefitContext = {
    originalAmount: params.bookingAmount,
    currentAmount: params.bookingAmount,
    eligibleAmount: params.bookingAmount,
    discountType: params.discountType === 'percentage' ? 'percentage' : 'fixed',
    discountValue: params.discountValue,
    maxDiscount: params.maxDiscountAmount,
  };
  const result = getBenefitCalculator().calculate(ctx);
  return resolveDiscountWithLegacyFallback(
    'service-booking-standard',
    params.legacyAmount,
    result.discountAmount
  );
}

export function computeServiceComboDiscountAmount(params: {
  bookingAmount: number;
  comboDiscountPercent: number;
  maxDiscountAmount?: number | null;
  legacyAmount: number;
}): number {
  const ctx: BenefitContext = {
    originalAmount: params.bookingAmount,
    currentAmount: params.bookingAmount,
    benefitType: COMBO_BENEFIT_TYPE,
    promotionType: COMBO_BENEFIT_TYPE,
    comboDiscountPercent: params.comboDiscountPercent,
    maxDiscount: params.maxDiscountAmount,
  };
  const result = getBenefitCalculator().calculateWithStrategy(ctx, COMBO_BENEFIT_TYPE);
  return resolveDiscountWithLegacyFallback(
    'service-booking-combo',
    params.legacyAmount,
    result.discountAmount
  );
}

export function computeServiceLoyaltyDiscountAmount(params: {
  discountType: string;
  discountValue: number;
  bookingAmount: number;
  maxDiscountAmount?: number | null;
  legacyAmount: number;
}): number {
  const ctx: BenefitContext = {
    originalAmount: params.bookingAmount,
    currentAmount: params.bookingAmount,
    discountType: params.discountType === 'percentage' ? 'percentage' : 'fixed',
    discountValue: params.discountValue,
    benefitType: LOYALTY_BENEFIT_TYPE,
    promotionType: LOYALTY_BENEFIT_TYPE,
    maxDiscount: params.maxDiscountAmount,
  };
  const result = getBenefitCalculator().calculateWithStrategy(ctx, LOYALTY_BENEFIT_TYPE);
  return resolveDiscountWithLegacyFallback(
    'service-booking-loyalty',
    params.legacyAmount,
    result.discountAmount
  );
}

export function computePlatformPromotionDiscountAmount(params: {
  discountType: string;
  discountValue: number;
  amount: number;
  maxDiscountAmount?: number | null;
  minOrderAmount?: number | null;
  legacyAmount: number;
}): number {
  if (params.amount <= 0) return 0;
  const min =
    params.minOrderAmount != null ? parseFloat(String(params.minOrderAmount)) : 0;
  if (min > 0 && params.amount < min) return 0;

  const ctx: BenefitContext = {
    originalAmount: params.amount,
    currentAmount: params.amount,
    eligibleAmount: params.amount,
    discountType: params.discountType === 'percentage' ? 'percentage' : 'fixed',
    discountValue: parseFloat(String(params.discountValue || 0)),
    maxDiscount: params.maxDiscountAmount,
  };
  const strategy =
    ctx.discountType === 'percentage' ? PERCENTAGE_BENEFIT_TYPE : FLAT_BENEFIT_TYPE;
  const result = getBenefitCalculator().calculateWithStrategy(ctx, strategy);
  return resolveDiscountWithLegacyFallback(
    'platform-promotion',
    params.legacyAmount,
    result.discountAmount
  );
}
