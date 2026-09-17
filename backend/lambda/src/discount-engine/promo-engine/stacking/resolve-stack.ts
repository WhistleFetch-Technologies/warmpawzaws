import type { AppliedBenefit, StackingPolicy } from '../types';

/**
 * Resolve stacking across eligible promotion benefit sets.
 * Priority: higher promotion.priority wins within discount conflicts.
 */
export function resolveStack(opts: {
  candidates: Array<{
    promotion_id: string;
    priority: number;
    stacking_policy: StackingPolicy | null;
    benefits: AppliedBenefit[];
  }>;
}): AppliedBenefit[] {
  const sorted = [...opts.candidates].sort((a, b) => b.priority - a.priority);
  const selected: AppliedBenefit[] = [];
  let discountTaken = false;

  for (const c of sorted) {
    const policy = c.stacking_policy || 'DISCOUNT_WITH_CASHBACK';
    const discounts = c.benefits.filter((b) => b.benefit_type === 'DISCOUNT');
    const cashbacks = c.benefits.filter((b) => b.benefit_type === 'CASHBACK');

    if (policy === 'NONE' && selected.length > 0) {
      continue;
    }

    if (discounts.length) {
      if (!discountTaken || policy === 'FULL_STACKING') {
        selected.push(...discounts);
        discountTaken = true;
      }
    }

    const allowCashback =
      policy === 'FULL_STACKING' ||
      policy === 'DISCOUNT_WITH_CASHBACK' ||
      policy === 'SERVICE_LEVEL' ||
      policy === 'ORDER_LEVEL' ||
      policy === 'CATEGORY_LEVEL' ||
      policy === 'NONE';

    if (cashbacks.length && allowCashback) {
      selected.push(...cashbacks);
    }

    if (policy === 'NONE') break;
  }

  return selected;
}
