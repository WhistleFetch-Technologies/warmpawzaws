import { DiscountDomain } from '../enums/discount-domain';
import { loadFundingConfiguration } from '../config/funding-config-loader';
import { loadLimitConfiguration } from '../config/limit-config-loader';
import { loadPriorityConfiguration } from '../config/priority-config-loader';
import { loadStackPolicyConfiguration } from '../config/stack-config-loader';
import type {
  FundingConfiguration,
  LimitConfiguration,
  PriorityConfiguration,
  StackPolicyConfiguration,
} from '../config/types';
import type { RuntimePolicy, RuntimePolicySources } from './runtime-policy';
import { attachPolicyFingerprint, type RuntimePolicyFingerprint } from './runtime-policy-fingerprint';

function mergePriorityForDomain(
  base: PriorityConfiguration,
  domain: DiscountDomain
): PriorityConfiguration {
  const override = base.domains?.[domain];
  if (!override) return { ...base, global: { ...base.global } };
  return {
    version: base.version,
    global: {
      ...base.global,
      strategy: override.strategy ?? base.global.strategy,
      tieBreakers: override.tieBreakers ?? base.global.tieBreakers,
      phases: { ...base.global.phases, ...override.phases },
      manualOrder: override.manualOrder ?? base.global.manualOrder,
    },
    domains: base.domains,
  };
}

function mergeStackForDomain(
  base: StackPolicyConfiguration,
  domain: DiscountDomain
): StackPolicyConfiguration {
  const override = base.domains?.[domain];
  if (!override) return { ...base, global: { ...base.global } };
  return {
    version: base.version,
    global: { ...base.global, ...override },
    domains: base.domains,
  };
}

function mergeLimitsForDomain(
  base: LimitConfiguration,
  domain: DiscountDomain
): LimitConfiguration {
  const override = base.domains?.[domain];
  if (!override) return { ...base, global: { ...base.global } };
  return {
    version: base.version,
    global: { ...base.global, ...override },
    domains: base.domains,
    campaigns: base.campaigns,
  };
}

export function buildRuntimePolicy(sources: RuntimePolicySources): RuntimePolicy {
  const priority = mergePriorityForDomain(sources.priority, sources.domain);
  const stack = mergeStackForDomain(sources.stack, sources.domain);
  const limits = mergeLimitsForDomain(sources.limits, sources.domain);
  const funding: FundingConfiguration = { ...sources.funding };

  return {
    domain: sources.domain,
    priority,
    stack,
    funding,
    limits,
    priorityVersion: priority.version,
    stackVersion: stack.version,
    fundingVersion: funding.version,
    limitsVersion: limits.version,
    featureFlagSnapshot: sources.featureFlagSnapshot,
    publishId: sources.publishId,
    mergedAt: new Date().toISOString(),
  };
}

export interface RuntimePolicyLoaderOptions {
  priority?: Partial<PriorityConfiguration>;
  stack?: Partial<StackPolicyConfiguration>;
  funding?: Partial<FundingConfiguration>;
  limits?: Partial<LimitConfiguration>;
  featureFlagSnapshot?: string;
  publishId?: string;
}

export function loadRuntimePolicy(
  domain: DiscountDomain,
  options: RuntimePolicyLoaderOptions = {}
): RuntimePolicyFingerprint {
  const sources: RuntimePolicySources = {
    domain,
    priority: loadPriorityConfiguration(options.priority),
    stack: loadStackPolicyConfiguration(options.stack),
    funding: loadFundingConfiguration(options.funding),
    limits: loadLimitConfiguration(options.limits),
    featureFlagSnapshot: options.featureFlagSnapshot,
    publishId: options.publishId,
  };
  return attachPolicyFingerprint(buildRuntimePolicy(sources));
}

export {
  getPriorityMode,
  isPriorityAuthoritative,
  isPriorityEnabled,
  isPriorityShadowEnabled,
  type PriorityMode,
} from './priority-mode';
