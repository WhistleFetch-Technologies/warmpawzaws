import type { DiscountDomain } from '../enums/discount-domain';
import type {
  FundingConfiguration,
  LimitConfiguration,
  PriorityConfiguration,
  StackPolicyConfiguration,
} from '../config/types';

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
  featureFlagSnapshot?: string;
  publishId?: string;
  mergedAt: string;
}

export interface RuntimePolicySources {
  priority: PriorityConfiguration;
  stack: StackPolicyConfiguration;
  funding: FundingConfiguration;
  limits: LimitConfiguration;
  domain: DiscountDomain;
  featureFlagSnapshot?: string;
  publishId?: string;
}
