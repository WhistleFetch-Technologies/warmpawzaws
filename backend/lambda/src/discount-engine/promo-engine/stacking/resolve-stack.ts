import type { AppliedBenefit, StackingPolicy } from '../types';

export type StackCandidate = {
  promotion_id: string;
  priority: number;
  stacking_policy: StackingPolicy | null;
  benefits: AppliedBenefit[];
  /** SERVICE_LEVEL = line id; CATEGORY_LEVEL = category; omit/order = order-level. */
  groupKey?: string;
};

function policyOf(c: StackCandidate): StackingPolicy {
  return c.stacking_policy || 'DISCOUNT_WITH_CASHBACK';
}

function isGroupPolicy(policy: StackingPolicy): boolean {
  return policy === 'SERVICE_LEVEL' || policy === 'CATEGORY_LEVEL';
}

/**
 * Resolve one group: higher priority wins on discount conflicts.
 * DISCOUNT_WITH_CASHBACK keeps cashback next to the winning discount.
 */
export function resolveStackGroup(candidates: StackCandidate[]): AppliedBenefit[] {
  const sorted = [...candidates].sort((a, b) => b.priority - a.priority);
  const selected: AppliedBenefit[] = [];
  let discountTaken = false;

  for (const c of sorted) {
    const policy = policyOf(c);
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

/**
 * Order-level exclusive policies collapse to one discount across groups.
 * SERVICE_LEVEL / CATEGORY_LEVEL keep one discount per groupKey.
 */
export function resolveStack(opts: { candidates: StackCandidate[] }): AppliedBenefit[] {
  const exclusive = opts.candidates.find((c) => policyOf(c) === 'NONE');
  const highest = [...opts.candidates].sort((a, b) => b.priority - a.priority)[0];
  if (exclusive && highest && exclusive.promotion_id === highest.promotion_id) {
    return resolveStackGroup([exclusive]);
  }

  const orderCandidates: StackCandidate[] = [];
  const grouped = new Map<string, StackCandidate[]>();

  for (const c of opts.candidates) {
    const policy = policyOf(c);
    if (isGroupPolicy(policy) && c.groupKey) {
      const list = grouped.get(c.groupKey) || [];
      list.push(c);
      grouped.set(c.groupKey, list);
    } else {
      orderCandidates.push(c);
    }
  }

  const orderSelected = resolveStackGroup(orderCandidates);
  const groupSelected = [...grouped.values()].flatMap((list) => resolveStackGroup(list));
  const orderHasDiscount = orderSelected.some((b) => b.benefit_type === 'DISCOUNT');
  const orderWinner = orderCandidates
    .slice()
    .sort((a, b) => b.priority - a.priority)
    .find((c) => c.benefits.some((b) => b.benefit_type === 'DISCOUNT'));
  const orderAllowsExtraDiscounts = orderWinner ? policyOf(orderWinner) === 'FULL_STACKING' : true;

  if (orderHasDiscount && !orderAllowsExtraDiscounts) {
    return [
      ...orderSelected,
      ...groupSelected.filter((b) => b.benefit_type === 'CASHBACK'),
    ];
  }

  return [...orderSelected, ...groupSelected];
}
