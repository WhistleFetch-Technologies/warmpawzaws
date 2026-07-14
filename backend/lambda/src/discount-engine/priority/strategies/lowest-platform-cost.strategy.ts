import type { EligibleBenefit, PriorityStrategy } from '../priority-types';
import { estimatePlatformCost } from '../priority-utils';

export const lowestPlatformCostStrategy: PriorityStrategy = {
  key: 'LOWEST_PLATFORM_COST',
  score(benefit: EligibleBenefit): number {
    const platformCost = estimatePlatformCost(benefit);
    return benefit.discountAmount * 1_000 - platformCost;
  },
};
