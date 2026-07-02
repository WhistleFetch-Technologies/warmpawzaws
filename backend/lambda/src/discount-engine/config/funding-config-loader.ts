import type { FundingConfiguration } from './types';

export const DEFAULT_FUNDING_CONFIGURATION: FundingConfiguration = {
  version: '1.0.0',
  sharedDefaultSplit: { platformPercent: 50, vendorPercent: 50 },
  stackVetoes: [],
  settlementHints: { roundTo: 2, currency: 'INR' },
  blockVendorFundedWithPlatformCoupon: false,
  blockSharedWithPlatformCoupon: false,
};

export function loadFundingConfiguration(
  override?: Partial<FundingConfiguration>
): FundingConfiguration {
  if (!override) return structuredClone(DEFAULT_FUNDING_CONFIGURATION);
  return {
    ...DEFAULT_FUNDING_CONFIGURATION,
    ...override,
    sharedDefaultSplit: {
      ...DEFAULT_FUNDING_CONFIGURATION.sharedDefaultSplit,
      ...override.sharedDefaultSplit,
    },
    settlementHints: {
      ...DEFAULT_FUNDING_CONFIGURATION.settlementHints,
      ...override.settlementHints,
    },
  };
}
