import type { DiscountDomain } from '../enums/discount-domain';
import type { StackPolicyConfiguration } from '../config/types';
import { loadStackPolicyConfiguration } from '../config/stack-config-loader';
import type { ResolvedStackPolicy } from './types';

/**
 * Resolves effective stack policy for a domain (global + domain override).
 * Configuration-driven — no hardcoded business rules.
 */
export function resolveStackPolicy(
  domain: DiscountDomain,
  override?: Partial<StackPolicyConfiguration>
): ResolvedStackPolicy {
  const base = loadStackPolicyConfiguration(override);
  const domainOverride = base.domains?.[domain];
  const global = domainOverride ? { ...base.global, ...domainOverride } : base.global;

  return {
    version: base.version,
    allowCouponWithPromotion: global.allowCouponWithPromotion,
    allowMultipleCoupons: global.allowMultipleCoupons,
    allowMultipleVendorPromotions: global.allowMultipleVendorPromotions,
    allowPlatformWithVendor: global.allowPlatformWithVendor,
    applicationModeDefault: global.applicationModeDefault,
    exclusiveSkipsCouponPhase: global.exclusiveSkipsCouponPhase,
    exclusiveTerminatesAll: global.exclusiveTerminatesAll,
    stackOrder: [...global.stackOrder],
    stackRules: [...(global.stackRules ?? [])],
  };
}
