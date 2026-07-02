import type { EligibleBenefit, PriorityStrategy } from '../priority-types';

export const fixedPriorityStrategy: PriorityStrategy = {
  key: 'FIXED_PRIORITY_WEIGHT',
  score(benefit: EligibleBenefit): number {
    const weight = benefit.candidate.priority ?? 0;
    return weight * 1_000_000 + benefit.discountAmount;
  },
};
