import type { DiscountDomain } from '../enums/discount-domain';
import type {
  FundingConfiguration,
  LimitConfiguration,
  PriorityConfiguration,
  StackPolicyConfiguration,
} from '../config/types';
import type { BusinessRulesConfiguration } from '../config/business-rules-types';

export interface RuntimePolicyVersions {
  priorityVersion: string;
  stackVersion: string;
  fundingVersion: string;
  limitsVersion: string;
}

export interface RuntimePolicy extends RuntimePolicyVersions {
  domain: DiscountDomain;
  priority: PriorityConfiguration;
  stack: StackPolicyConfiguration;
  funding: FundingConfiguration;
  limits: LimitConfiguration;
  /** Optional business rules overlay from Policy Center publish bundle. */
  businessRules?: BusinessRulesConfiguration;
  featureFlagSnapshot?: string;
  publishId?: string;
  mergedAt: string;
}

export interface RuntimePolicySources {
  priority: PriorityConfiguration;
  stack: StackPolicyConfiguration;
  funding: FundingConfiguration;
  limits: LimitConfiguration;
  businessRules?: BusinessRulesConfiguration;
  domain: DiscountDomain;
  featureFlagSnapshot?: string;
  publishId?: string;
}
