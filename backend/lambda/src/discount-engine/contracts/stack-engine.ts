import type { DiscountContext } from '../models/discount-context';
import type { AppliedDiscount, DiscountEngineResult } from '../models/discount-result';

export interface StackPolicy {
  allowCouponWithPromotion: boolean;
  allowMultipleCoupons: boolean;
  allowMultipleVendorPromotions: boolean;
  allowPlatformWithVendor: boolean;
}

/**
 * Applies stacking rules across multiple discounts.
 * Phase 6 will replace ad-hoc stacking in legacy engines.
 */
export interface StackEngine {
  readonly defaultPolicy: StackPolicy;
  apply(
    context: DiscountContext,
    candidates: AppliedDiscount[]
  ): DiscountEngineResult | Promise<DiscountEngineResult>;
}
