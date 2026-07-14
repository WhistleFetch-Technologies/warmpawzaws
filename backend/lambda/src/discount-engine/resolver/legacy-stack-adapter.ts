import { DiscountSource } from '../enums/discount-source';
import { DiscountTrigger } from '../enums/discount-trigger';
import type { DiscountContext } from '../models/discount-context';
import type { RuntimePolicy } from '../policy/runtime-policy';
import type { EligibleBenefit } from '../priority/priority-types';
import type { CandidateBenefitOutcome } from './types';

function isVendorAuto(benefit: EligibleBenefit): boolean {
  return (
    benefit.candidate.trigger === DiscountTrigger.AUTO &&
    (benefit.candidate.source === DiscountSource.VENDOR_PROMOTION ||
      benefit.candidate.source === DiscountSource.VENDOR_COUPON)
  );
}

function isPlatformAuto(benefit: EligibleBenefit): boolean {
  return (
    benefit.candidate.trigger === DiscountTrigger.AUTO &&
    benefit.candidate.source === DiscountSource.PLATFORM_PROMOTION
  );
}

function isCoupon(benefit: EligibleBenefit): boolean {
  return benefit.candidate.trigger === DiscountTrigger.CODE;
}

/**
 * Applies legacy stack coexistence rules to priority-selected candidates.
 * Does not re-rank or apply selection limits — Priority Engine owns that.
 */
export function applyLegacyStackToSelected(
  selectedCandidates: EligibleBenefit[],
  runtimePolicy: RuntimePolicy,
  _context: DiscountContext
): EligibleBenefit[] {
  if (!selectedCandidates.length) return [];

  const stack = runtimePolicy.stack.global;
  let result = [...selectedCandidates];

  const exclusiveSelected = result.filter((b) => b.candidate.exclusive);
  if (exclusiveSelected.length > 0 && stack.exclusiveTerminatesAll) {
    return [exclusiveSelected[0]!];
  }

  if (!stack.allowCouponWithPromotion) {
    const hasAuto = result.some((b) => b.candidate.trigger === DiscountTrigger.AUTO);
    if (hasAuto) {
      result = result.filter((b) => !isCoupon(b));
    }
  }

  if (!stack.allowMultipleCoupons) {
    const coupons = result.filter((b) => isCoupon(b));
    if (coupons.length > 1) {
      const couponIds = new Set(coupons.slice(1).map((c) => c.candidate.id));
      result = result.filter((b) => !couponIds.has(b.candidate.id));
    }
  }

  if (!stack.allowMultipleVendorPromotions) {
    const vendorAutos = result.filter((b) => isVendorAuto(b));
    if (vendorAutos.length > 1) {
      const dropIds = new Set(vendorAutos.slice(1).map((b) => b.candidate.id));
      result = result.filter((b) => !dropIds.has(b.candidate.id));
    }
  }

  if (!stack.allowPlatformWithVendor) {
    const hasVendor = result.some((b) => isVendorAuto(b));
    const hasPlatform = result.some((b) => isPlatformAuto(b));
    if (hasVendor && hasPlatform) {
      result = result.filter((b) => !isPlatformAuto(b));
    }
  }

  return result;
}

export function mapSelectedToBenefitOutcomes(
  selected: EligibleBenefit[],
  benefitResults: CandidateBenefitOutcome[]
): CandidateBenefitOutcome[] {
  const byId = new Map(benefitResults.map((o) => [o.candidate.id, o]));
  return selected
    .map((s) => byId.get(s.candidate.id))
    .filter((o): o is CandidateBenefitOutcome => o != null);
}
