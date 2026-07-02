import type { PriorityConfiguration } from './types';

export const DEFAULT_PRIORITY_CONFIGURATION: PriorityConfiguration = {
  version: '1.0.0',
  global: {
    strategy: 'MAX_CUSTOMER_SAVINGS',
    tieBreakers: ['EXCLUSIVE', 'SPOTLIGHT', 'PRIORITY_WEIGHT', 'VALID_FROM', 'ID'],
    phases: {
      AUTO_PROMOTIONS: { maxSelected: 2 },
      COUPONS: { maxSelected: 1 },
    },
  },
  domains: {
    SERVICE: {
      strategy: 'VENDOR_SPOTLIGHT_FIRST',
      phases: { AUTO_PROMOTIONS: { maxSelected: 2 }, COUPONS: { maxSelected: 1 } },
    },
    ECOMMERCE: {
      strategy: 'MAX_CUSTOMER_SAVINGS',
      phases: { AUTO_PROMOTIONS: { maxSelected: 1 }, COUPONS: { maxSelected: 1 } },
    },
  },
};

export function loadPriorityConfiguration(
  override?: Partial<PriorityConfiguration>
): PriorityConfiguration {
  if (!override) return structuredClone(DEFAULT_PRIORITY_CONFIGURATION);
  return deepMergePriority(DEFAULT_PRIORITY_CONFIGURATION, override);
}

function deepMergePriority(
  base: PriorityConfiguration,
  override: Partial<PriorityConfiguration>
): PriorityConfiguration {
  return {
    version: override.version ?? base.version,
    global: { ...base.global, ...override.global },
    domains: { ...base.domains, ...override.domains },
  };
}
