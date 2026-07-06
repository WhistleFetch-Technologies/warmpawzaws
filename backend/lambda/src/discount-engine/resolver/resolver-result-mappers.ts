import { DiscountOwner } from '../enums/discount-owner';
import { DiscountSource } from '../enums/discount-source';
import { DiscountTrigger } from '../enums/discount-trigger';
import type { AppliedDiscount } from '../models/discount-result';
import type { BookingPromotionResult } from '../../utils/service-promotion-engine';
import type { PromotionEvaluation } from '../../utils/vendor-promotion-engine';
import type { ResolverResult } from './types';

function isCouponApplied(d: AppliedDiscount): boolean {
  return (
    d.trigger === DiscountTrigger.CODE &&
    (d.legacySource === 'coupon' ||
      d.metadata?.source === DiscountSource.PLATFORM_COUPON ||
      d.metadata?.source === DiscountSource.VENDOR_COUPON)
  );
}

function splitAppliedAmounts(applied: AppliedDiscount[]) {
  let vendorDiscountAmount = 0;
  let platformDiscountAmount = 0;
  let couponDiscountAmount = 0;
  let vendorPromotionId: string | undefined;
  let platformPromotionId: string | undefined;
  let couponId: string | undefined;

  for (const d of applied) {
    if (isCouponApplied(d)) {
      couponDiscountAmount += d.discountAmount;
      couponId = d.id;
      continue;
    }
    if (d.owner === DiscountOwner.VENDOR) {
      vendorDiscountAmount += d.discountAmount;
      vendorPromotionId = d.id;
      continue;
    }
    if (d.owner === DiscountOwner.PLATFORM) {
      platformDiscountAmount += d.discountAmount;
      platformPromotionId = d.id;
    }
  }

  return {
    vendorDiscountAmount,
    platformDiscountAmount,
    couponDiscountAmount,
    vendorPromotionId,
    platformPromotionId,
    couponId,
  };
}

/** Map unified resolver output → legacy booking stack shape (S1/S2/S5). */
export function mapResolverResultToBookingPromotion(
  result: ResolverResult
): BookingPromotionResult {
  const split = splitAppliedAmounts(result.applied);
  const applied = result.applied
    .filter((d) => !isCouponApplied(d))
    .map((d) => ({
      source: d.owner === DiscountOwner.VENDOR ? ('vendor' as const) : ('platform' as const),
      id: d.id,
      name: d.name,
      discountAmount: d.discountAmount,
      promotionType: d.benefitType,
    }));

  if (split.couponDiscountAmount > 0 && split.couponId) {
    applied.push({
      source: 'platform',
      id: split.couponId,
      name: 'Coupon',
      discountAmount: split.couponDiscountAmount,
      promotionType: 'coupon',
    });
  }

  return {
    originalAmount: result.originalAmount,
    vendorDiscountAmount: split.vendorDiscountAmount,
    platformDiscountAmount: split.platformDiscountAmount + split.couponDiscountAmount,
    totalSavings: result.totalSavings,
    finalAmount: result.finalAmount,
    applied,
    vendorPromotionId: split.vendorPromotionId,
    platformPromotionId: split.platformPromotionId ?? split.couponId,
  };
}

/** Map resolver output → discount-calculation-service shape (includes coupon line). */
export function mapResolverResultToDiscountCalculation(result: ResolverResult) {
  const booking = mapResolverResultToBookingPromotion(result);
  const split = splitAppliedAmounts(result.applied);

  return {
    originalAmount: booking.originalAmount,
    vendorDiscountAmount: booking.vendorDiscountAmount,
    platformDiscountAmount: booking.platformDiscountAmount - split.couponDiscountAmount,
    couponDiscountAmount: split.couponDiscountAmount,
    totalDiscountAmount: booking.totalSavings,
    finalAmount: booking.finalAmount,
    appliedDiscounts: result.applied.map((d, idx) => ({
      id: d.id,
      type: isCouponApplied(d)
        ? ('coupon' as const)
        : d.owner === DiscountOwner.VENDOR
          ? ('vendor' as const)
          : ('platform' as const),
      name: d.name,
      discountType: 'percentage' as const,
      discountValue: 0,
      discountAmount: d.discountAmount,
      order: idx + 1,
    })),
    vendorPromotionId: booking.vendorPromotionId,
    platformPromotionId: booking.platformPromotionId,
    settlement: result.settlement,
    resolverVersion: result.resolverVersion,
  };
}

export function mapResolverResultToCartPromotion(
  result: ResolverResult,
  originalTotal: number
): {
  originalTotal: number;
  discountedTotal: number;
  totalSavings: number;
  bestPromotion: PromotionEvaluation | null;
  allPromotions: PromotionEvaluation[];
  platformCouponId?: string;
  platformCouponDiscount?: number;
} {
  const best = result.applied[0];
  const split = splitAppliedAmounts(result.applied);

  let bestPromotion: PromotionEvaluation | null = null;
  if (best && !isCouponApplied(best)) {
    bestPromotion = {
      discountAmount: best.discountAmount,
      promotionId: best.id,
      promotionType: best.benefitType ?? 'standard',
      label: best.name,
      description: best.name,
      affectedProductIds: [],
      autoApplyEligible: best.trigger === DiscountTrigger.AUTO,
      promotion: {
        id: best.id,
        name: best.name,
        promotion_type: best.benefitType ?? 'standard',
        discount_type: 'percentage',
        discount_value: 0,
        start_date: '',
        end_date: '',
        is_active: true,
      },
    };
  }

  const platformCouponDiscount = split.couponDiscountAmount;
  const totalSavings = result.totalSavings;

  return {
    originalTotal,
    discountedTotal: result.finalAmount,
    totalSavings,
    bestPromotion,
    allPromotions: bestPromotion ? [bestPromotion] : [],
    platformCouponId: split.couponId,
    platformCouponDiscount,
  };
}

export function mapResolverResultToValidateCodeResponse(result: ResolverResult): {
  valid: boolean;
  discount_amount: number;
  final_amount: number;
  promotion_id?: string;
  promo_category?: 'service' | 'product' | 'platform' | 'coupon';
} {
  if (result.totalSavings <= 0 && result.applied.length === 0) {
    return { valid: false, discount_amount: 0, final_amount: result.originalAmount };
  }

  const applied = result.applied[0];
  const discount_amount = result.totalSavings;
  const promo_category = applied
    ? isCouponApplied(applied)
      ? 'coupon'
      : applied.metadata?.source === DiscountSource.VENDOR_PROMOTION ||
          applied.metadata?.source === DiscountSource.VENDOR_COUPON
        ? applied.metadata?.min_booking_value != null
          ? 'service'
          : 'product'
        : 'platform'
    : 'platform';

  return {
    valid: true,
    discount_amount,
    final_amount: result.finalAmount,
    promotion_id: applied?.id,
    promo_category: promo_category as 'service' | 'product' | 'platform' | 'coupon',
  };
}

export function mapResolverResultToCouponValidation(result: ResolverResult): {
  valid: boolean;
  discountAmount: number;
  couponId?: string;
} {
  const split = splitAppliedAmounts(result.applied);
  return {
    valid: result.totalSavings > 0 || result.applied.length > 0,
    discountAmount: split.couponDiscountAmount || result.totalSavings,
    couponId: split.couponId ?? result.applied[0]?.id,
  };
}

export function isResolverResultAuthoritativeUsable(result: ResolverResult | null): result is ResolverResult {
  if (!result) return false;
  if (result.metadata?.priority && (result.metadata.priority as { fallbackReason?: string }).fallbackReason) {
    return false;
  }
  return true;
}
