import type { DiscountDomain } from '../enums/discount-domain';
import type { FundingConfiguration } from '../config/types';
import { loadFundingConfiguration } from '../config/funding-config-loader';
import type { ResolvedSettlementPolicy } from './types';

/**
 * Settlement policy derived from FundingConfiguration — no hardcoded splits.
 */
export function resolveSettlementPolicy(
  _domain: DiscountDomain,
  funding?: Partial<FundingConfiguration>
): ResolvedSettlementPolicy {
  const config = loadFundingConfiguration(funding);
  return {
    version: config.version,
    sharedDefaultSplit: { ...config.sharedDefaultSplit },
    roundTo: config.settlementHints.roundTo,
    currency: config.settlementHints.currency,
  };
}
