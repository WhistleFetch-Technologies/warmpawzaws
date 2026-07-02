import type { DiscountDomain } from '../enums/discount-domain';
import type { StackPolicyConfiguration } from '../config/types';
import { loadStackPolicyConfiguration } from '../config/stack-config-loader';
import { resolveStackPolicy } from './stack-policy';
import type { ResolvedStackPolicy } from './types';

/**
 * Effective stack configuration for a domain (global + domain override).
 * Read-only view for Stack Engine — no hardcoded business rules.
 */
export interface StackConfiguration {
  domain: DiscountDomain;
  policy: ResolvedStackPolicy;
  raw: StackPolicyConfiguration;
}

export function loadStackConfiguration(
  domain: DiscountDomain,
  override?: Partial<StackPolicyConfiguration>
): StackConfiguration {
  const raw = loadStackPolicyConfiguration(override);
  return {
    domain,
    policy: resolveStackPolicy(domain, override),
    raw,
  };
}
