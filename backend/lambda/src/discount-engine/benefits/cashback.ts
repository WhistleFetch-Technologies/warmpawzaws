import type { BenefitResult } from './types';
import { CASHBACK_BENEFIT_TYPE } from './strategies/cashback-benefit.strategy';

export { CASHBACK_BENEFIT_TYPE };

export function isCashbackBenefit(result: BenefitResult): boolean {
  return result.appliedBenefit === CASHBACK_BENEFIT_TYPE;
}

export function isCashbackOutcome(outcome: { benefit: BenefitResult }): boolean {
  return isCashbackBenefit(outcome.benefit);
}

export function partitionCashbackBenefitOutcomes<T extends { benefit: BenefitResult }>(
  outcomes: T[]
): {
  discountBenefits: T[];
  cashbackBenefits: T[];
} {
  const discountBenefits: T[] = [];
  const cashbackBenefits: T[] = [];
  for (const outcome of outcomes) {
    if (isCashbackOutcome(outcome)) cashbackBenefits.push(outcome);
    else discountBenefits.push(outcome);
  }
  return { discountBenefits, cashbackBenefits };
}

export function sumCashbackAmount(outcomes: Array<{ benefit: BenefitResult }>): number {
  return outcomes.reduce((sum, outcome) => sum + (Number(outcome.benefit.cashbackAmount) || 0), 0);
}

export function buildPbeCashbackIdempotencyKey(params: {
  referenceType: string;
  referenceId: string;
  promotionId: string;
}): string {
  return `pbe_cashback:${params.referenceType}:${params.referenceId}:${params.promotionId}`;
}
