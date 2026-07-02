import { DiscountDomain } from '../../enums/discount-domain';
import { loadRuntimePolicy } from '../runtime-policy-loader';
import {
  createDefaultPolicyValidationEngine,
  PolicyValidationEngine,
} from '../policy-validation-engine';
import { duplicateRuleValidator } from '../validation-rules/duplicate-rule.validator';
import { createValidatorRegistry } from '../validator-registry';

describe('PolicyValidationEngine', () => {
  const engine = createDefaultPolicyValidationEngine();

  it('passes default runtime policy', () => {
    const policy = loadRuntimePolicy(DiscountDomain.SERVICE);
    const result = engine.validate(policy);
    expect(result.isPublishable).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('errors when maxCoupons=0 and allowCouponWithPromotion', () => {
    const policy = loadRuntimePolicy(DiscountDomain.PHARMACY, {
      limits: {
        version: '1.0.0',
        global: {
          maxAutoPromotions: 2,
          maxVendorPromotions: 1,
          maxPlatformPromotions: 1,
          maxCoupons: 0,
          maxTotalDiscounts: 3,
          maxTotalDiscountPercent: 100,
          minPayableAmount: 1,
          capOverflowStrategy: 'REJECT_LAST',
        },
      },
    });
    const result = engine.validate(policy);
    expect(result.errors.some((e) => e.ruleId === 'limits.coupon.zeroWithStack')).toBe(true);
    expect(result.isPublishable).toBe(false);
  });

  it('errors on duplicate stack rule ids', () => {
    const registry = createValidatorRegistry([duplicateRuleValidator]);
    const custom = new PolicyValidationEngine(registry);
    const policy = loadRuntimePolicy(DiscountDomain.SERVICE, {
      stack: {
        version: '1.0.0',
        global: {
          allowCouponWithPromotion: true,
          allowMultipleCoupons: false,
          allowMultipleVendorPromotions: false,
          allowPlatformWithVendor: true,
          applicationModeDefault: 'SEQUENTIAL',
          exclusiveSkipsCouponPhase: true,
          exclusiveTerminatesAll: true,
          stackOrder: [],
          stackRules: [
            { id: 'dup', left: { source: 'A' }, right: { source: 'B' }, allowed: true },
            { id: 'dup', left: { source: 'C' }, right: { source: 'D' }, allowed: false },
          ],
        },
      },
    });
    const result = custom.validate(policy);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('includes validated fingerprint in result', () => {
    const policy = loadRuntimePolicy(DiscountDomain.ECOMMERCE);
    const result = engine.validate(policy);
    expect(result.validatedFingerprint).toBe(policy.policyFingerprint);
  });
});
