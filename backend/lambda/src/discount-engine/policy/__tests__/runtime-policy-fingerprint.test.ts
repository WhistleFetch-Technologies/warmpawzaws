import { DiscountDomain } from '../../enums/discount-domain';
import { loadRuntimePolicy, buildRuntimePolicy } from '../runtime-policy-loader';
import {
  canonicalizeRuntimePolicy,
  computePolicyFingerprint,
} from '../runtime-policy-fingerprint';

describe('RuntimePolicyFingerprint', () => {
  it('produces stable fingerprint for same merged policy', () => {
    const a = loadRuntimePolicy(DiscountDomain.SERVICE);
    const b = loadRuntimePolicy(DiscountDomain.SERVICE);
    expect(a.policyFingerprint).toBe(b.policyFingerprint);
    expect(a.policyFingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it('changes fingerprint when domain override differs', () => {
    const service = loadRuntimePolicy(DiscountDomain.SERVICE);
    const ecommerce = loadRuntimePolicy(DiscountDomain.ECOMMERCE);
    expect(service.policyFingerprint).not.toBe(ecommerce.policyFingerprint);
  });

  it('canonical JSON is deterministic', () => {
    const policy = loadRuntimePolicy(DiscountDomain.SERVICE);
    const built = buildRuntimePolicy({
      domain: DiscountDomain.SERVICE,
      priority: policy.priority,
      stack: policy.stack,
      funding: policy.funding,
      limits: policy.limits,
    });
    const c1 = canonicalizeRuntimePolicy(built);
    const c2 = canonicalizeRuntimePolicy(built);
    expect(c1).toBe(c2);
  });
});

describe('RuntimePolicyLoader', () => {
  it('merges domain priority override for SERVICE', () => {
    const policy = loadRuntimePolicy(DiscountDomain.SERVICE);
    expect(policy.priority.global.strategy).toBe('VENDOR_SPOTLIGHT_FIRST');
  });

  it('uses ecommerce auto promotion limit override', () => {
    const policy = loadRuntimePolicy(DiscountDomain.ECOMMERCE);
    expect(policy.limits.global.maxAutoPromotions).toBe(1);
  });
});
