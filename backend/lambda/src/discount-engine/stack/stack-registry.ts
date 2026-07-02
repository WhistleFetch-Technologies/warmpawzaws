import { DiscountSource } from '../enums/discount-source';
import { DiscountTrigger } from '../enums/discount-trigger';
import type { EligibleBenefit } from '../priority/priority-types';

export type StackPhase = 'AUTO_PROMOTIONS' | 'COUPONS';

export function classifyStackPhase(benefit: EligibleBenefit): StackPhase {
  return benefit.candidate.trigger === DiscountTrigger.CODE ? 'COUPONS' : 'AUTO_PROMOTIONS';
}

export function sourceStackKey(source: DiscountSource): string {
  return String(source);
}

export function isVendorSource(source: DiscountSource): boolean {
  return (
    source === DiscountSource.VENDOR_PROMOTION || source === DiscountSource.VENDOR_COUPON
  );
}

export function isPlatformSource(source: DiscountSource): boolean {
  return (
    source === DiscountSource.PLATFORM_PROMOTION || source === DiscountSource.PLATFORM_COUPON
  );
}

export function isCouponSource(source: DiscountSource): boolean {
  return (
    source === DiscountSource.PLATFORM_COUPON || source === DiscountSource.VENDOR_COUPON
  );
}

export function isAutoPromotionSource(source: DiscountSource): boolean {
  return (
    source === DiscountSource.VENDOR_PROMOTION || source === DiscountSource.PLATFORM_PROMOTION
  );
}

/** Sort candidates by configured stack order (vendor → platform → coupon). */
export function sortByStackOrder(
  candidates: EligibleBenefit[],
  stackOrder: string[]
): EligibleBenefit[] {
  const rank = (source: DiscountSource): number => {
    const key = sourceStackKey(source);
    const idx = stackOrder.indexOf(key);
    return idx === -1 ? stackOrder.length : idx;
  };
  return [...candidates].sort((a, b) => rank(a.candidate.source) - rank(b.candidate.source));
}

export function splitByPhase(candidates: EligibleBenefit[]): {
  auto: EligibleBenefit[];
  coupons: EligibleBenefit[];
} {
  const auto: EligibleBenefit[] = [];
  const coupons: EligibleBenefit[] = [];
  for (const c of candidates) {
    if (classifyStackPhase(c) === 'COUPONS') {
      coupons.push(c);
    } else {
      auto.push(c);
    }
  }
  return { auto, coupons };
}
