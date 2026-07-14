import { DiscountDomain } from '../../enums/discount-domain';
import { DiscountOwner } from '../../enums/discount-owner';
import { DiscountSource } from '../../enums/discount-source';
import { buildRuntimeBenefitCandidate } from '../../candidates/runtime-candidate';
import { computeBenefitFromCandidate } from '../../candidates/bridges/candidate-to-benefit-context';
import { COMBO_BENEFIT_TYPE, LOYALTY_BENEFIT_TYPE } from '../strategies';

export function computeServiceStandardDiscountAmount(params: {
  discountType: string;
  discountValue: number;
  bookingAmount: number;
  maxDiscountAmount?: number | null;
  legacyAmount: number;
}): number {
  const candidate = buildRuntimeBenefitCandidate({
    domain: DiscountDomain.SERVICE,
    owner: DiscountOwner.VENDOR,
    benefits: {
      type: 'flash_sale',
      discountType: params.discountType === 'percentage' ? 'percentage' : 'fixed',
      value: params.discountValue,
      maxDiscount: params.maxDiscountAmount,
    },
  });
  return computeBenefitFromCandidate(candidate, {
    originalAmount: params.bookingAmount,
    currentAmount: params.bookingAmount,
    eligibleAmount: params.bookingAmount,
    legacyAmount: params.legacyAmount,
    label: 'service-booking-standard',
  });
}

export function computeServiceComboDiscountAmount(params: {
  bookingAmount: number;
  comboDiscountPercent: number;
  maxDiscountAmount?: number | null;
  legacyAmount: number;
}): number {
  const candidate = buildRuntimeBenefitCandidate({
    domain: DiscountDomain.SERVICE,
    owner: DiscountOwner.VENDOR,
    benefits: {
      type: COMBO_BENEFIT_TYPE,
      value: params.comboDiscountPercent,
      comboDiscountPercent: params.comboDiscountPercent,
      maxDiscount: params.maxDiscountAmount,
    },
  });
  return computeBenefitFromCandidate(candidate, {
    originalAmount: params.bookingAmount,
    currentAmount: params.bookingAmount,
    legacyAmount: params.legacyAmount,
    label: 'service-booking-combo',
  });
}

export function computeServiceLoyaltyDiscountAmount(params: {
  discountType: string;
  discountValue: number;
  bookingAmount: number;
  maxDiscountAmount?: number | null;
  legacyAmount: number;
}): number {
  const candidate = buildRuntimeBenefitCandidate({
    domain: DiscountDomain.SERVICE,
    owner: DiscountOwner.VENDOR,
    benefits: {
      type: LOYALTY_BENEFIT_TYPE,
      discountType: params.discountType === 'percentage' ? 'percentage' : 'fixed',
      value: params.discountValue,
      maxDiscount: params.maxDiscountAmount,
    },
  });
  return computeBenefitFromCandidate(candidate, {
    originalAmount: params.bookingAmount,
    currentAmount: params.bookingAmount,
    legacyAmount: params.legacyAmount,
    label: 'service-booking-loyalty',
  });
}

export function computePlatformPromotionDiscountAmount(params: {
  discountType: string;
  discountValue: number;
  amount: number;
  maxDiscountAmount?: number | null;
  minOrderAmount?: number | null;
  legacyAmount: number;
}): number {
  const candidate = buildRuntimeBenefitCandidate({
    domain: DiscountDomain.SERVICE,
    owner: DiscountOwner.PLATFORM,
    source: DiscountSource.PLATFORM_PROMOTION,
    benefits: {
      type: 'flash_sale',
      discountType: params.discountType === 'percentage' ? 'percentage' : 'fixed',
      value: parseFloat(String(params.discountValue || 0)),
      maxDiscount: params.maxDiscountAmount,
      minOrderAmount: params.minOrderAmount,
    },
  });
  return computeBenefitFromCandidate(candidate, {
    originalAmount: params.amount,
    currentAmount: params.amount,
    eligibleAmount: params.amount,
    legacyAmount: params.legacyAmount,
    label: 'platform-promotion',
  });
}
