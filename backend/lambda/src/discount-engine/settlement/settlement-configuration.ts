import type { DiscountDomain } from '../enums/discount-domain';
import type { FundingConfiguration } from '../config/types';
import { loadFundingConfiguration } from '../config/funding-config-loader';
import { resolveSettlementPolicy } from './settlement-policy';
import type { ResolvedSettlementPolicy } from './types';

export interface SettlementConfiguration {
  domain: DiscountDomain;
  policy: ResolvedSettlementPolicy;
  funding: FundingConfiguration;
}

export function loadSettlementConfiguration(
  domain: DiscountDomain,
  fundingOverride?: Partial<FundingConfiguration>
): SettlementConfiguration {
  const funding = loadFundingConfiguration(fundingOverride);
  return {
    domain,
    policy: resolveSettlementPolicy(domain, fundingOverride),
    funding,
  };
}
