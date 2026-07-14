import { DiscountTrigger } from '../enums/discount-trigger';
import { DiscountFunding } from '../enums/discount-funding';
import type { TieBreakerKey } from '../config/types';
import type { EligibleBenefit, ScoredBenefit } from './priority-types';

export function isSpotlightCandidate(benefit: EligibleBenefit): boolean {
  const entity = benefit.candidate.originalEntity ?? {};
  const meta = benefit.candidate.metadata ?? {};
  return Boolean(
    meta.isSpotlight ??
      meta.is_spotlight ??
      entity.is_spotlight ??
      entity.isSpotlight
  );
}

export function compareByTieBreaker(
  a: ScoredBenefit,
  b: ScoredBenefit,
  tieBreaker: TieBreakerKey
): number {
  switch (tieBreaker) {
    case 'EXCLUSIVE': {
      const ae = a.benefit.candidate.exclusive ? 1 : 0;
      const be = b.benefit.candidate.exclusive ? 1 : 0;
      return be - ae;
    }
    case 'SPOTLIGHT': {
      const as = isSpotlightCandidate(a.benefit) ? 1 : 0;
      const bs = isSpotlightCandidate(b.benefit) ? 1 : 0;
      return bs - as;
    }
    case 'PRIORITY_WEIGHT': {
      const ap = a.benefit.candidate.priority ?? 0;
      const bp = b.benefit.candidate.priority ?? 0;
      return bp - ap;
    }
    case 'VALID_FROM': {
      const ad = a.benefit.candidate.startDate ?? '';
      const bd = b.benefit.candidate.startDate ?? '';
      return ad.localeCompare(bd);
    }
    case 'ID':
      return a.benefit.candidate.id.localeCompare(b.benefit.candidate.id);
    default:
      return 0;
  }
}

export function sortScoredBenefits(
  scored: ScoredBenefit[],
  tieBreakers: TieBreakerKey[]
): ScoredBenefit[] {
  return [...scored].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    for (const tb of tieBreakers) {
      const cmp = compareByTieBreaker(a, b, tb);
      if (cmp !== 0) return cmp;
    }
    return 0;
  });
}

export function estimatePlatformCost(benefit: EligibleBenefit): number {
  const funding = benefit.candidate.funding;
  const amount = benefit.discountAmount;
  if (funding === DiscountFunding.PLATFORM) return amount;
  if (funding === DiscountFunding.VENDOR) return 0;
  if (funding === DiscountFunding.SHARED) return amount * 0.5;
  return amount * 0.5;
}

export function manualOrderIndex(
  candidateId: string,
  manualOrder: string[] | undefined
): number {
  if (!manualOrder?.length) return Number.MAX_SAFE_INTEGER;
  const idx = manualOrder.indexOf(candidateId);
  return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
}

export function filterBenefitsForPhase(
  benefits: EligibleBenefit[],
  phase: 'AUTO_PROMOTIONS' | 'COUPONS'
): EligibleBenefit[] {
  if (phase === 'AUTO_PROMOTIONS') {
    return benefits.filter((b) => b.candidate.trigger === DiscountTrigger.AUTO);
  }
  return benefits.filter((b) => b.candidate.trigger === DiscountTrigger.CODE);
}

export function resolveSelectionLimit(
  phase: 'AUTO_PROMOTIONS' | 'COUPONS',
  priorityMaxSelected: number | undefined,
  limits: {
    maxAutoPromotions: number;
    maxCoupons: number;
  }
): number {
  const phaseLimit =
    phase === 'AUTO_PROMOTIONS' ? limits.maxAutoPromotions : limits.maxCoupons;
  const caps = [phaseLimit];
  if (priorityMaxSelected != null) caps.push(priorityMaxSelected);
  return Math.min(...caps);
}
