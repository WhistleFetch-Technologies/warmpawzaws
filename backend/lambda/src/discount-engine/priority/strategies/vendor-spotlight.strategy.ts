import type { EligibleBenefit, PriorityStrategy, PriorityStrategyContext } from '../priority-types';
import { isSpotlightCandidate } from '../priority-utils';

export const vendorSpotlightStrategy: PriorityStrategy = {
  key: 'VENDOR_SPOTLIGHT_FIRST',
  score(benefit: EligibleBenefit): number {
    const spotlightBoost = isSpotlightCandidate(benefit) ? 1_000_000_000 : 0;
    return spotlightBoost + benefit.discountAmount;
  },
};

export const adminManualOrderStrategy: PriorityStrategy = {
  key: 'ADMIN_MANUAL_ORDER',
  score(benefit: EligibleBenefit, ctx: PriorityStrategyContext): number {
    const order = ctx.manualOrder ?? [];
    const idx = order.indexOf(benefit.candidate.id);
    const rankScore = idx === -1 ? 0 : order.length - idx;
    return rankScore * 1_000_000_000 + benefit.discountAmount;
  },
};
