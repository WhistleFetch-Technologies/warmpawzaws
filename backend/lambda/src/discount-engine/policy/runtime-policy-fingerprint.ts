import { createHash } from 'crypto';
import type { RuntimePolicy } from './runtime-policy';

function sortKeysDeep(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (typeof value !== 'object') return value;
  const record = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(record).sort()) {
    const v = record[key];
    if (v !== undefined) sorted[key] = sortKeysDeep(v);
  }
  return sorted;
}

/** Canonical JSON for deterministic fingerprinting (STACK_POLICY §8.7). */
export function canonicalizeRuntimePolicy(policy: RuntimePolicy): string {
  const payload = {
    domain: policy.domain,
    priority: policy.priority,
    stack: policy.stack,
    funding: policy.funding,
    limits: policy.limits,
    priorityVersion: policy.priorityVersion,
    stackVersion: policy.stackVersion,
    fundingVersion: policy.fundingVersion,
    limitsVersion: policy.limitsVersion,
    featureFlagSnapshot: policy.featureFlagSnapshot ?? null,
    publishId: policy.publishId ?? null,
  };
  return JSON.stringify(sortKeysDeep(payload));
}

export function computePolicyFingerprint(policy: RuntimePolicy): string {
  const canonical = canonicalizeRuntimePolicy(policy);
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

export interface RuntimePolicyFingerprint extends RuntimePolicy {
  policyFingerprint: string;
}

export function attachPolicyFingerprint(policy: RuntimePolicy): RuntimePolicyFingerprint {
  return {
    ...policy,
    policyFingerprint: computePolicyFingerprint(policy),
  };
}
