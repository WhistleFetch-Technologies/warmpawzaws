import { evaluateCandidateBenefit } from '../candidates/bridges/candidate-to-benefit-context';
import type { DiscountContext } from '../models/discount-context';
import type { EligibleBenefit } from '../priority/priority-types';
import {
  discountContextToBenefitRuntime,
} from '../resolver/context-runtime';

/**
 * Recomputes benefit amount on the current running amount (sequential re-base).
 * Does not rank or filter — math only.
 */
export function recomputeBenefitOnRunningAmount(
  benefit: EligibleBenefit,
  context: DiscountContext,
  runningAmount: number,
  benefitRuntime?: ReturnType<typeof discountContextToBenefitRuntime>
): number {
  const runtime = benefitRuntime ?? discountContextToBenefitRuntime(context);
  const result = evaluateCandidateBenefit(benefit.candidate, {
    ...runtime,
    originalAmount: context.amount,
    currentAmount: runningAmount,
  });
  return Math.max(0, result.discountAmount);
}

export function applySequentialDiscount(
  runningAmount: number,
  discountAmount: number
): { runningAfter: number; appliedDiscount: number } {
  const appliedDiscount = Math.min(Math.max(0, discountAmount), runningAmount);
  return {
    runningAfter: Math.max(0, runningAmount - appliedDiscount),
    appliedDiscount,
  };
}
