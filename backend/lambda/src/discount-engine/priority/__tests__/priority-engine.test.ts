import { DiscountDomain } from '../../enums/discount-domain';
import { DiscountOwner } from '../../enums/discount-owner';
import { DiscountSource } from '../../enums/discount-source';
import { DiscountTrigger } from '../../enums/discount-trigger';
import type { DiscountContext } from '../../models/discount-context';
import type { EligibleBenefit } from '../priority-types';
import { PriorityEngine } from '../priority-engine';
import { createDefaultStrategyRegistry } from '../strategy-registry';

function benefit(
  id: string,
  amount: number,
  opts: Partial<{ trigger: DiscountTrigger; exclusive: boolean; spotlight: boolean; priority: number }> = {}
): EligibleBenefit {
  return {
    discountAmount: amount,
    benefitType: 'percentage',
    candidate: {
      id,
      name: id,
      source: DiscountSource.VENDOR_PROMOTION,
      owner: DiscountOwner.VENDOR,
      domain: DiscountDomain.SERVICE,
      trigger: opts.trigger ?? DiscountTrigger.AUTO,
      status: 'ACTIVE' as never,
      exclusive: opts.exclusive,
      priority: opts.priority,
      rules: {},
      benefits: { type: 'flash_sale', value: 10 },
      originalEntity: opts.spotlight ? { is_spotlight: true } : {},
    },
  };
}

const baseContext: DiscountContext = {
  domain: DiscountDomain.SERVICE,
  trigger: DiscountTrigger.AUTO,
  amount: 1000,
};

describe('PriorityEngine', () => {
  const engine = new PriorityEngine(createDefaultStrategyRegistry());

  it('ranks by MAX_CUSTOMER_SAVINGS descending', () => {
    const runtime = {
      domain: DiscountDomain.SERVICE,
      priority: {
        version: '1',
        global: {
          strategy: 'MAX_CUSTOMER_SAVINGS' as const,
          tieBreakers: ['ID' as const],
          phases: { AUTO_PROMOTIONS: { maxSelected: 3 } },
        },
      },
      limits: {
        version: '1',
        global: {
          maxAutoPromotions: 3,
          maxVendorPromotions: 3,
          maxPlatformPromotions: 3,
          maxCoupons: 1,
          maxTotalDiscounts: 3,
          maxTotalDiscountPercent: 100,
          minPayableAmount: 1,
          capOverflowStrategy: 'REJECT_LAST' as const,
        },
      },
    };

    const result = engine.prioritize({
      eligibleBenefits: [
        benefit('low', 50),
        benefit('high', 200),
        benefit('mid', 100),
      ],
      context: baseContext,
      priorityConfiguration: runtime.priority,
      limitConfiguration: runtime.limits,
      runtimePolicy: runtime as never,
      policyFingerprint: 'test-fp',
      phase: 'AUTO_PROMOTIONS',
    });

    expect(result.orderedCandidateList.map((b) => b.candidate.id)).toEqual([
      'high',
      'mid',
      'low',
    ]);
    expect(result.selectedCandidates).toHaveLength(3);
    expect(result.priorityAudit.policyFingerprint).toBe('test-fp');
  });

  it('truncates by selection limit into rejectedByLimit', () => {
    const runtime = {
      domain: DiscountDomain.SERVICE,
      priority: {
        version: '1',
        global: {
          strategy: 'MAX_CUSTOMER_SAVINGS' as const,
          tieBreakers: ['ID' as const],
          phases: { AUTO_PROMOTIONS: { maxSelected: 1 } },
        },
      },
      limits: {
        version: '1',
        global: {
          maxAutoPromotions: 2,
          maxVendorPromotions: 2,
          maxPlatformPromotions: 2,
          maxCoupons: 1,
          maxTotalDiscounts: 3,
          maxTotalDiscountPercent: 100,
          minPayableAmount: 1,
          capOverflowStrategy: 'REJECT_LAST' as const,
        },
      },
    };

    const result = engine.prioritize({
      eligibleBenefits: [benefit('a', 100), benefit('b', 80)],
      context: baseContext,
      priorityConfiguration: runtime.priority,
      limitConfiguration: runtime.limits,
      runtimePolicy: runtime as never,
      policyFingerprint: 'fp',
      phase: 'AUTO_PROMOTIONS',
    });

    expect(result.selectedCandidates).toHaveLength(1);
    expect(result.rejectedByLimit).toHaveLength(1);
    expect(result.rejectedByLimit[0].reasonCode).toBe('PROMOTION_LIMIT');
  });

  it('flags exclusive candidates without enforcing', () => {
    const runtime = {
      domain: DiscountDomain.SERVICE,
      priority: {
        version: '1',
        global: {
          strategy: 'MAX_CUSTOMER_SAVINGS' as const,
          tieBreakers: ['EXCLUSIVE' as const, 'ID' as const],
          phases: { AUTO_PROMOTIONS: { maxSelected: 2 } },
        },
      },
      limits: {
        version: '1',
        global: {
          maxAutoPromotions: 2,
          maxVendorPromotions: 2,
          maxPlatformPromotions: 2,
          maxCoupons: 1,
          maxTotalDiscounts: 3,
          maxTotalDiscountPercent: 100,
          minPayableAmount: 1,
          capOverflowStrategy: 'REJECT_LAST' as const,
        },
      },
    };

    const result = engine.prioritize({
      eligibleBenefits: [
        benefit('regular', 500),
        benefit('exclusive', 10, { exclusive: true }),
      ],
      context: baseContext,
      priorityConfiguration: runtime.priority,
      limitConfiguration: runtime.limits,
      runtimePolicy: runtime as never,
      policyFingerprint: 'fp',
      phase: 'AUTO_PROMOTIONS',
    });

    expect(result.exclusiveCandidates.map((e) => e.candidateId)).toContain('exclusive');
    expect(result.selectedCandidates).toHaveLength(2);
  });

  it('returns empty selected when selection limit is 0', () => {
    const runtime = {
      domain: DiscountDomain.SERVICE,
      priority: {
        version: '1',
        global: {
          strategy: 'MAX_CUSTOMER_SAVINGS' as const,
          tieBreakers: ['ID' as const],
          phases: { AUTO_PROMOTIONS: { maxSelected: 0 } },
        },
      },
      limits: {
        version: '1',
        global: {
          maxAutoPromotions: 0,
          maxVendorPromotions: 0,
          maxPlatformPromotions: 0,
          maxCoupons: 0,
          maxTotalDiscounts: 0,
          maxTotalDiscountPercent: 100,
          minPayableAmount: 1,
          capOverflowStrategy: 'REJECT_LAST' as const,
        },
      },
    };

    const result = engine.prioritize({
      eligibleBenefits: [benefit('a', 100)],
      context: baseContext,
      priorityConfiguration: runtime.priority,
      limitConfiguration: runtime.limits,
      runtimePolicy: runtime as never,
      policyFingerprint: 'fp',
      phase: 'AUTO_PROMOTIONS',
    });

    expect(result.selectedCandidates).toHaveLength(0);
    expect(result.rejectedByLimit).toHaveLength(1);
  });

  it('VENDOR_SPOTLIGHT ranks spotlight first at equal savings', () => {
    const runtime = {
      domain: DiscountDomain.SERVICE,
      priority: {
        version: '1',
        global: {
          strategy: 'VENDOR_SPOTLIGHT_FIRST' as const,
          tieBreakers: ['ID' as const],
          phases: { AUTO_PROMOTIONS: { maxSelected: 2 } },
        },
      },
      limits: {
        version: '1',
        global: {
          maxAutoPromotions: 2,
          maxVendorPromotions: 2,
          maxPlatformPromotions: 2,
          maxCoupons: 1,
          maxTotalDiscounts: 3,
          maxTotalDiscountPercent: 100,
          minPayableAmount: 1,
          capOverflowStrategy: 'REJECT_LAST' as const,
        },
      },
    };

    const result = engine.prioritize({
      eligibleBenefits: [
        benefit('plain', 100),
        benefit('spot', 100, { spotlight: true }),
      ],
      context: baseContext,
      priorityConfiguration: runtime.priority,
      limitConfiguration: runtime.limits,
      runtimePolicy: runtime as never,
      policyFingerprint: 'fp',
      phase: 'AUTO_PROMOTIONS',
    });

    expect(result.orderedCandidateList[0].candidate.id).toBe('spot');
  });
});
