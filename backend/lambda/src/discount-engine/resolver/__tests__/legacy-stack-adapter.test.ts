import { DiscountDomain } from '../../enums/discount-domain';
import { DiscountOwner } from '../../enums/discount-owner';
import { DiscountSource } from '../../enums/discount-source';
import { DiscountTrigger } from '../../enums/discount-trigger';
import { loadRuntimePolicy } from '../../policy/runtime-policy-loader';
import type { EligibleBenefit } from '../../priority/priority-types';
import {
  applyLegacyStackToSelected,
  mapSelectedToBenefitOutcomes,
} from '../legacy-stack-adapter';
import type { CandidateBenefitOutcome } from '../types';

function eligible(id: string, trigger: DiscountTrigger, source: DiscountSource, exclusive = false): EligibleBenefit {
  return {
    candidate: {
      id,
      name: id,
      source,
      owner: DiscountOwner.VENDOR,
      domain: DiscountDomain.ECOMMERCE,
      trigger,
      status: 'ACTIVE' as never,
      rules: {},
      benefits: { type: 'flash_sale', value: 10 },
      exclusive,
      originalEntity: {},
    },
    discountAmount: 100,
    benefitType: 'percentage',
  };
}

describe('legacy-stack-adapter', () => {
  it('removes platform auto when allowPlatformWithVendor is false', () => {
    const policy = loadRuntimePolicy(DiscountDomain.ECOMMERCE);
    const selected = [
      eligible('v1', DiscountTrigger.AUTO, DiscountSource.VENDOR_PROMOTION),
      eligible('p1', DiscountTrigger.AUTO, DiscountSource.PLATFORM_PROMOTION),
    ];
    const result = applyLegacyStackToSelected(selected, policy, {
      domain: DiscountDomain.ECOMMERCE,
      trigger: DiscountTrigger.AUTO,
      amount: 1000,
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.candidate.id).toBe('v1');
  });

  it('exclusive terminates all other selections', () => {
    const policy = loadRuntimePolicy(DiscountDomain.SERVICE);
    const selected = [
      eligible('e1', DiscountTrigger.AUTO, DiscountSource.VENDOR_PROMOTION, true),
      eligible('v2', DiscountTrigger.AUTO, DiscountSource.VENDOR_PROMOTION),
    ];
    const result = applyLegacyStackToSelected(selected, policy, {
      domain: DiscountDomain.SERVICE,
      trigger: DiscountTrigger.AUTO,
      amount: 1000,
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.candidate.exclusive).toBe(true);
  });

  it('maps selected benefits back to benefit outcomes', () => {
    const outcomes: CandidateBenefitOutcome[] = [
      {
        candidate: eligible('a', DiscountTrigger.AUTO, DiscountSource.VENDOR_PROMOTION).candidate,
        benefit: { discountAmount: 50, finalAmount: 950, appliedBenefit: 'percentage' },
        discountAmount: 50,
      },
    ];
    const mapped = mapSelectedToBenefitOutcomes(
      [eligible('a', DiscountTrigger.AUTO, DiscountSource.VENDOR_PROMOTION)],
      outcomes
    );
    expect(mapped).toHaveLength(1);
    expect(mapped[0]?.discountAmount).toBe(50);
  });
});
