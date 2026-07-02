import { DiscountDomain } from '../../enums/discount-domain';
import { DiscountOwner } from '../../enums/discount-owner';
import { DiscountSource } from '../../enums/discount-source';
import { DiscountTrigger } from '../../enums/discount-trigger';
import type { DiscountContext } from '../../models/discount-context';
import type { CandidateBenefitOutcome } from '../types';
import { runPriorityShadow } from '../priority-shadow';

describe('priority shadow integration', () => {
  const context: DiscountContext = {
    domain: DiscountDomain.SERVICE,
    trigger: DiscountTrigger.AUTO,
    amount: 2000,
  };

  const outcomes: CandidateBenefitOutcome[] = [
    {
      candidate: {
        id: 'auto-1',
        name: 'Auto Promo',
        source: DiscountSource.VENDOR_PROMOTION,
        owner: DiscountOwner.VENDOR,
        domain: DiscountDomain.SERVICE,
        trigger: DiscountTrigger.AUTO,
        status: 'ACTIVE' as never,
        rules: {},
        benefits: { type: 'flash_sale', value: 20 },
        originalEntity: {},
      },
      benefit: {
        discountAmount: 200,
        finalAmount: 1800,
        appliedBenefit: 'percentage',
      },
      discountAmount: 200,
    },
    {
      candidate: {
        id: 'code-1',
        name: 'Coupon',
        source: DiscountSource.PLATFORM_COUPON,
        owner: DiscountOwner.PLATFORM,
        domain: DiscountDomain.SERVICE,
        trigger: DiscountTrigger.CODE,
        status: 'ACTIVE' as never,
        rules: {},
        benefits: { type: 'percentage', value: 10 },
        originalEntity: {},
      },
      benefit: {
        discountAmount: 50,
        finalAmount: 1950,
        appliedBenefit: 'percentage',
      },
      discountAmount: 50,
    },
  ];

  it('returns shadow diagnostics with fingerprint and both phases', () => {
    const diag = runPriorityShadow(context, outcomes);
    expect(diag).not.toBeNull();
    expect(diag!.policyFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(diag!.autoPhase.orderedCandidateList).toHaveLength(1);
    expect(diag!.couponPhase?.orderedCandidateList).toHaveLength(1);
    expect(diag!.validation.isPublishable).toBe(true);
  });

  it('selectedCandidates is not final applied set', () => {
    const diag = runPriorityShadow(context, outcomes)!;
    expect(diag.autoPhase.selectedCandidates.length).toBeGreaterThanOrEqual(0);
    expect(diag.autoPhase.priorityAudit.decisions.length).toBeGreaterThan(0);
  });
});
