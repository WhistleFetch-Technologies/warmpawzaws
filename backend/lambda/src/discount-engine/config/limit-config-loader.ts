import type { LimitConfiguration } from './types';

export const DEFAULT_LIMIT_CONFIGURATION: LimitConfiguration = {
  version: '1.0.0',
  global: {
    maxAutoPromotions: 2,
    maxVendorPromotions: 1,
    maxPlatformPromotions: 1,
    maxCoupons: 1,
    maxTotalDiscounts: 3,
    maxTotalDiscountPercent: 100,
    minPayableAmount: 1,
    capOverflowStrategy: 'REJECT_LAST',
  },
  domains: {
    SERVICE: { maxAutoPromotions: 2, maxCoupons: 1 },
    ECOMMERCE: { maxAutoPromotions: 1, maxCoupons: 1 },
  },
};

export function loadLimitConfiguration(
  override?: Partial<LimitConfiguration>
): LimitConfiguration {
  if (!override) return structuredClone(DEFAULT_LIMIT_CONFIGURATION);
  return {
    version: override.version ?? DEFAULT_LIMIT_CONFIGURATION.version,
    global: { ...DEFAULT_LIMIT_CONFIGURATION.global, ...override.global },
    domains: { ...DEFAULT_LIMIT_CONFIGURATION.domains, ...override.domains },
    campaigns: { ...DEFAULT_LIMIT_CONFIGURATION.campaigns, ...override.campaigns },
  };
}
