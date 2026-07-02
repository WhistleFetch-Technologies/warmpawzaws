import { DiscountDomain } from '../../enums/discount-domain';
import { DiscountFunding } from '../../enums/discount-funding';
import { DiscountOwner } from '../../enums/discount-owner';
import { DiscountSource } from '../../enums/discount-source';
import { DiscountTrigger } from '../../enums/discount-trigger';
import { loadRuntimePolicy } from '../../policy/runtime-policy-loader';
import type { EligibleBenefit } from '../../priority/priority-types';
import { getConflictResolver, resetConflictResolverForTests } from '../conflict-resolver';
import { resolveStackPolicy } from '../stack-policy';
import {
  DefaultStackEngine,
  getStackEngine,
  resetStackEngineForTests,
} from '../stack-engine';
import { getStackMode } from '../stack-mode';
import type { CandidateBenefitOutcome } from '../../resolver/types';

function benefit(
  id: string,
  source: DiscountSource,
  trigger: DiscountTrigger,
  discountValue: number,
  discountType: 'percentage' | 'fixed' = 'percentage',
  opts: { exclusive?: boolean; funding?: DiscountFunding; maxDiscount?: number } = {}
): EligibleBenefit {
  return {
    candidate: {
      id,
      name: id,
      source,
      owner: source.startsWith('VENDOR') ? DiscountOwner.VENDOR : DiscountOwner.PLATFORM,
      domain: DiscountDomain.SERVICE,
      trigger,
      status: 'ACTIVE' as never,
      rules: {},
      benefits: {
        type: 'flash_sale',
        value: discountValue,
        discountType,
        maxDiscount: opts.maxDiscount,
      },
      exclusive: opts.exclusive,
      funding: opts.funding,
      originalEntity: {},
    },
    discountAmount: discountType === 'fixed' ? discountValue : 0,
    benefitType: discountType,
  };
}

function outcomeFrom(b: EligibleBenefit, amount: number): CandidateBenefitOutcome {
  return {
    candidate: b.candidate,
    benefit: {
      discountAmount: amount,
      finalAmount: 1000 - amount,
      appliedBenefit: b.benefitType ?? 'percentage',
    },
    discountAmount: amount,
  };
}

describe('Stack Engine — unit', () => {
  beforeEach(() => {
    resetStackEngineForTests();
    resetConflictResolverForTests();
    delete process.env.DISCOUNT_ENGINE_V2_STACK_MODE;
  });

  const context = {
    domain: DiscountDomain.SERVICE,
    trigger: DiscountTrigger.AUTO,
    amount: 1000,
    vendorId: 'v-1',
  };

  it('applies vendor then platform sequentially (10% then 20% on running amount)', () => {
    const vendor = benefit('v1', DiscountSource.VENDOR_PROMOTION, DiscountTrigger.AUTO, 10);
    const platform = benefit('p1', DiscountSource.PLATFORM_PROMOTION, DiscountTrigger.AUTO, 20);
    const runtimePolicy = loadRuntimePolicy(DiscountDomain.SERVICE);

    const decision = getStackEngine().stack({
      context,
      selectedCandidates: [platform, vendor],
      benefitResults: [outcomeFrom(vendor, 100), outcomeFrom(platform, 200)],
      runtimePolicy,
      policyFingerprint: runtimePolicy.policyFingerprint,
    });

    expect(decision.applied).toHaveLength(2);
    expect(decision.applied[0]?.candidate.id).toBe('v1');
    expect(decision.applied[0]?.discountAmount).toBe(100);
    expect(decision.applied[1]?.candidate.id).toBe('p1');
    expect(decision.applied[1]?.discountAmount).toBe(180);
    expect(decision.runningAmount).toBe(720);
    expect(decision.totalSavings).toBe(280);
  });

  it('applies promotion then coupon sequentially (vendor 10% then ₹100 flat)', () => {
    const vendor = benefit('v1', DiscountSource.VENDOR_PROMOTION, DiscountTrigger.AUTO, 10);
    const coupon = benefit(
      'c1',
      DiscountSource.PLATFORM_COUPON,
      DiscountTrigger.CODE,
      100,
      'fixed'
    );
    const runtimePolicy = loadRuntimePolicy(DiscountDomain.SERVICE);

    const decision = getStackEngine().stack({
      context,
      selectedCandidates: [coupon, vendor],
      benefitResults: [
        outcomeFrom(vendor, 100),
        outcomeFrom(coupon, 100),
      ],
      runtimePolicy,
      policyFingerprint: runtimePolicy.policyFingerprint,
    });

    expect(decision.applied).toHaveLength(2);
    expect(decision.applied[0]?.candidate.id).toBe('v1');
    expect(decision.applied[1]?.candidate.id).toBe('c1');
    expect(decision.runningAmount).toBe(800);
    expect(decision.totalSavings).toBe(200);
  });

  it('exclusive promotion terminates stack and rejects others', () => {
    const exclusive = benefit(
      'e1',
      DiscountSource.PLATFORM_PROMOTION,
      DiscountTrigger.AUTO,
      30,
      'percentage',
      { exclusive: true }
    );
    const other = benefit('v1', DiscountSource.VENDOR_PROMOTION, DiscountTrigger.AUTO, 10);
    const runtimePolicy = loadRuntimePolicy(DiscountDomain.SERVICE);

    const decision = getStackEngine().stack({
      context,
      selectedCandidates: [exclusive, other],
      benefitResults: [outcomeFrom(exclusive, 300), outcomeFrom(other, 100)],
      runtimePolicy,
      policyFingerprint: runtimePolicy.policyFingerprint,
    });

    expect(decision.applied).toHaveLength(1);
    expect(decision.applied[0]?.candidate.exclusive).toBe(true);
    expect(decision.rejected.some((r) => r.reason === 'EXCLUSIVE')).toBe(true);
  });

  it('ecommerce domain override rejects platform when vendor present', () => {
    const vendor = benefit('v1', DiscountSource.VENDOR_PROMOTION, DiscountTrigger.AUTO, 10);
    const platform = benefit('p1', DiscountSource.PLATFORM_PROMOTION, DiscountTrigger.AUTO, 15);
    const runtimePolicy = loadRuntimePolicy(DiscountDomain.ECOMMERCE);
    const ecommerceContext = {
      ...context,
      domain: DiscountDomain.ECOMMERCE,
    };

    const decision = getStackEngine().stack({
      context: ecommerceContext,
      selectedCandidates: [vendor, platform],
      benefitResults: [outcomeFrom(vendor, 100), outcomeFrom(platform, 150)],
      runtimePolicy,
      policyFingerprint: runtimePolicy.policyFingerprint,
    });

    expect(decision.applied).toHaveLength(1);
    expect(decision.applied[0]?.candidate.id).toBe('v1');
    expect(decision.rejected.some((r) => r.reasonCode === 'PLATFORM_VENDOR_COEXISTENCE' || r.reason === 'CONFLICT')).toBe(true);
  });

  it('preserves funding metadata on applied steps', () => {
    const vendor = benefit(
      'v1',
      DiscountSource.VENDOR_PROMOTION,
      DiscountTrigger.AUTO,
      10,
      'percentage',
      { funding: DiscountFunding.VENDOR }
    );
    const runtimePolicy = loadRuntimePolicy(DiscountDomain.SERVICE);

    const decision = getStackEngine().stack({
      context,
      selectedCandidates: [vendor],
      benefitResults: [outcomeFrom(vendor, 100)],
      runtimePolicy,
      policyFingerprint: runtimePolicy.policyFingerprint,
    });

    expect(decision.audit.appliedSteps[0]?.funding).toBe(String(DiscountFunding.VENDOR));
  });

  it('generates stack audit with rejected candidates', () => {
    const vendor = benefit('v1', DiscountSource.VENDOR_PROMOTION, DiscountTrigger.AUTO, 10);
    const vendor2 = benefit('v2', DiscountSource.VENDOR_PROMOTION, DiscountTrigger.AUTO, 5);
    const runtimePolicy = loadRuntimePolicy(DiscountDomain.SERVICE);

    const decision = getStackEngine().stack({
      context,
      selectedCandidates: [vendor, vendor2],
      benefitResults: [outcomeFrom(vendor, 100), outcomeFrom(vendor2, 50)],
      runtimePolicy,
      policyFingerprint: runtimePolicy.policyFingerprint,
    });

    expect(decision.audit.rejected.length).toBeGreaterThan(0);
    expect(decision.audit.stackVersion).toBe('1.0.0');
    expect(decision.audit.policyFingerprint).toBe(runtimePolicy.policyFingerprint);
  });

  it('respects maxTotalDiscounts limit from configuration', () => {
    const runtimePolicy = loadRuntimePolicy(DiscountDomain.SERVICE);
    runtimePolicy.limits.global.maxTotalDiscounts = 1;
    const v1 = benefit('v1', DiscountSource.VENDOR_PROMOTION, DiscountTrigger.AUTO, 10);
    const p1 = benefit('p1', DiscountSource.PLATFORM_PROMOTION, DiscountTrigger.AUTO, 10);

    const decision = getStackEngine().stack({
      context,
      selectedCandidates: [v1, p1],
      benefitResults: [outcomeFrom(v1, 100), outcomeFrom(p1, 100)],
      runtimePolicy,
      policyFingerprint: runtimePolicy.policyFingerprint,
    });

    expect(decision.applied.length).toBeLessThanOrEqual(1);
    expect(decision.rejected.some((r) => r.reason === 'LIMIT')).toBe(true);
  });
});

describe('Stack mode flags', () => {
  it('defaults to AUTHORITATIVE when unset', () => {
    delete process.env.DISCOUNT_ENGINE_V2_STACK_MODE;
    expect(getStackMode()).toBe('AUTHORITATIVE');
  });

  it('reads OFF SHADOW AUTHORITATIVE from env', () => {
    process.env.DISCOUNT_ENGINE_V2_STACK_MODE = 'OFF';
    expect(getStackMode()).toBe('OFF');
    process.env.DISCOUNT_ENGINE_V2_STACK_MODE = 'SHADOW';
    expect(getStackMode()).toBe('SHADOW');
  });
});

describe('ConflictResolver', () => {
  beforeEach(() => resetConflictResolverForTests());

  it('rejects duplicate candidate ids', () => {
    const policy = resolveStackPolicy(DiscountDomain.SERVICE);
    const funding = loadRuntimePolicy(DiscountDomain.SERVICE).funding;
    const b = benefit('a', DiscountSource.VENDOR_PROMOTION, DiscountTrigger.AUTO, 10);
    const resolver = getConflictResolver();
    const check = resolver.canApply(
      b,
      [b],
      { domain: DiscountDomain.SERVICE, trigger: DiscountTrigger.AUTO, amount: 1000 },
      policy,
      funding,
      'AUTO_PROMOTIONS'
    );
    expect(check.allowed).toBe(false);
    expect(check.reason).toBe('DUPLICATE');
  });
});

describe('DefaultStackEngine — empty input', () => {
  beforeEach(() => resetStackEngineForTests());

  it('returns empty decision when no candidates', () => {
    const runtimePolicy = loadRuntimePolicy(DiscountDomain.SERVICE);
    const decision = new DefaultStackEngine().stack({
      context: { domain: DiscountDomain.SERVICE, trigger: DiscountTrigger.AUTO, amount: 500 },
      selectedCandidates: [],
      benefitResults: [],
      runtimePolicy,
      policyFingerprint: runtimePolicy.policyFingerprint,
    });
    expect(decision.applied).toHaveLength(0);
    expect(decision.runningAmount).toBe(500);
  });
});
