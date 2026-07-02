import type { StackPolicyConfiguration } from './types';

export const DEFAULT_STACK_POLICY_CONFIGURATION: StackPolicyConfiguration = {
  version: '1.0.0',
  global: {
    allowCouponWithPromotion: true,
    allowMultipleCoupons: false,
    allowMultipleVendorPromotions: false,
    allowPlatformWithVendor: true,
    applicationModeDefault: 'SEQUENTIAL',
    exclusiveSkipsCouponPhase: true,
    exclusiveTerminatesAll: true,
    stackOrder: [
      'VENDOR_PROMOTION',
      'PLATFORM_PROMOTION',
      'VENDOR_COUPON',
      'PLATFORM_COUPON',
    ],
    stackRules: [],
  },
  domains: {
    SERVICE: { allowPlatformWithVendor: true },
    ECOMMERCE: { allowPlatformWithVendor: false },
  },
};

export function loadStackPolicyConfiguration(
  override?: Partial<StackPolicyConfiguration>
): StackPolicyConfiguration {
  if (!override) return structuredClone(DEFAULT_STACK_POLICY_CONFIGURATION);
  return {
    version: override.version ?? DEFAULT_STACK_POLICY_CONFIGURATION.version,
    global: { ...DEFAULT_STACK_POLICY_CONFIGURATION.global, ...override.global },
    domains: { ...DEFAULT_STACK_POLICY_CONFIGURATION.domains, ...override.domains },
  };
}
