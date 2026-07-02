import type { RuntimePolicy } from '../runtime-policy';
import type { PolicyValidator } from '../validator-registry';
import type { ValidationFinding } from '../validation-result';

export const invalidLimitValidator: PolicyValidator = {
  id: 'invalid-limits',
  validate(policy: RuntimePolicy): ValidationFinding[] {
    const findings: ValidationFinding[] = [];
    const { limits, stack } = policy;
    const maxCoupons = limits.global.maxCoupons;

    if (maxCoupons === 0 && stack.global.allowCouponWithPromotion) {
      findings.push({
        severity: 'error',
        ruleId: 'limits.coupon.zeroWithStack',
        message: 'maxCoupons is 0 but allowCouponWithPromotion is true',
        path: 'limits.global.maxCoupons',
        suggestion: 'Set maxCoupons >= 1 or disable allowCouponWithPromotion',
      });
    }

    if (
      !stack.global.allowPlatformWithVendor &&
      limits.global.maxAutoPromotions > 1
    ) {
      findings.push({
        severity: 'warning',
        ruleId: 'limits.promo.platformVendorDisabled',
        message:
          'allowPlatformWithVendor is false but maxAutoPromotions > 1 — second promotion may never coexist',
        path: 'limits.global.maxAutoPromotions',
      });
    }

    const couponMaxSelected = policy.priority.global.phases.COUPONS?.maxSelected;
    if (
      couponMaxSelected != null &&
      couponMaxSelected > limits.global.maxCoupons
    ) {
      findings.push({
        severity: 'warning',
        ruleId: 'limits.priority.couponMismatch',
        message: 'Priority COUPONS maxSelected exceeds limits.maxCoupons',
        path: 'priority.global.phases.COUPONS.maxSelected',
      });
    }

    if (limits.global.maxTotalDiscountPercent < 10 && limits.global.maxAutoPromotions > 1) {
      findings.push({
        severity: 'warning',
        ruleId: 'limits.percent.aggressiveStack',
        message: 'Low maxTotalDiscountPercent with multiple auto promotions',
        path: 'limits.global.maxTotalDiscountPercent',
      });
    }

    return findings;
  },
};
