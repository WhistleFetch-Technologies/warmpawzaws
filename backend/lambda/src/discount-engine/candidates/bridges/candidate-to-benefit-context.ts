import { DiscountDomain } from '../../enums/discount-domain';
import { getBenefitCalculator } from '../../benefits/benefit-calculator';
import { resolveDiscountWithLegacyFallback } from '../../benefits/compare';
import type { BenefitContext, BenefitLineItem, BenefitResult } from '../../benefits/types';
import {
  BOGO_BENEFIT_TYPE,
  BUNDLE_BENEFIT_TYPE,
  COMBO_BENEFIT_TYPE,
  FLAT_BENEFIT_TYPE,
  LOYALTY_BENEFIT_TYPE,
  PERCENTAGE_BENEFIT_TYPE,
} from '../../benefits/strategies';
import type { DiscountCandidate } from '../types';

export interface CandidateBenefitRuntimeContext {
  originalAmount: number;
  currentAmount?: number;
  eligibleAmount?: number;
  items?: BenefitLineItem[];
  legacyAmount: number;
  label: string;
}

function resolveBenefitStrategy(candidate: DiscountCandidate): string {
  const t = candidate.benefits.type;
  if (t === 'buy_x_get_y') return BOGO_BENEFIT_TYPE;
  if (t === 'bundle') return BUNDLE_BENEFIT_TYPE;
  if (t === 'combo') return COMBO_BENEFIT_TYPE;
  if (t === 'loyalty') return LOYALTY_BENEFIT_TYPE;
  if (candidate.benefits.discountType === 'percentage') return PERCENTAGE_BENEFIT_TYPE;
  return FLAT_BENEFIT_TYPE;
}

/** Maps canonical candidate + runtime amounts → Benefit Engine input. */
export function candidateToBenefitContext(
  candidate: DiscountCandidate,
  runtime: Omit<CandidateBenefitRuntimeContext, 'legacyAmount' | 'label'>
): BenefitContext {
  const current = runtime.currentAmount ?? runtime.originalAmount;
  const eligible = runtime.eligibleAmount ?? current;

  return {
    originalAmount: runtime.originalAmount,
    currentAmount: current,
    eligibleAmount: eligible,
    items: runtime.items,
    discountType: candidate.benefits.discountType,
    discountValue: candidate.benefits.value,
    maxDiscount: candidate.benefits.maxDiscount,
    benefitType: resolveBenefitStrategy(candidate),
    promotionType: candidate.benefits.type,
    buyQuantity: candidate.benefits.buyQuantity ?? undefined,
    getQuantity: candidate.benefits.getQuantity ?? undefined,
    getDiscountPercent: candidate.benefits.getDiscountPercent ?? undefined,
    bundleProductIds: candidate.benefits.bundleProductIds,
    bundleDiscountPercent: candidate.benefits.bundleDiscountPercent ?? undefined,
    comboDiscountPercent:
      candidate.benefits.comboDiscountPercent ?? candidate.benefits.value ?? undefined,
    domain: candidate.domain,
    metadata: { candidateId: candidate.id, source: candidate.source },
  };
}

/**
 * Single benefit entry point for DiscountCandidate.
 * Legacy adapters delegate here after normalizing rows.
 */
export function computeBenefitFromCandidate(
  candidate: DiscountCandidate,
  runtime: CandidateBenefitRuntimeContext
): number {
  const amount = runtime.currentAmount ?? runtime.originalAmount;
  if (candidate.domain === DiscountDomain.SERVICE && candidate.benefits.minOrderAmount) {
    const min = candidate.benefits.minOrderAmount;
    if (min > 0 && amount > 0 && amount < min) return runtime.legacyAmount;
  }

  const ctx = candidateToBenefitContext(candidate, runtime);
  const strategy = resolveBenefitStrategy(candidate);
  const calculator = getBenefitCalculator();
  const result =
    strategy === PERCENTAGE_BENEFIT_TYPE || strategy === FLAT_BENEFIT_TYPE
      ? calculator.calculate(ctx)
      : calculator.calculateWithStrategy(ctx, strategy);

  return resolveDiscountWithLegacyFallback(
    runtime.label,
    runtime.legacyAmount,
    result.discountAmount
  );
}

/** Benefit evaluation for resolver pipeline — no legacy fallback. */
export function evaluateCandidateBenefit(
  candidate: DiscountCandidate,
  runtime: Omit<CandidateBenefitRuntimeContext, 'legacyAmount' | 'label'>
): BenefitResult {
  const ctx = candidateToBenefitContext(candidate, runtime);
  const strategy = resolveBenefitStrategy(candidate);
  const calculator = getBenefitCalculator();
  if (strategy === PERCENTAGE_BENEFIT_TYPE || strategy === FLAT_BENEFIT_TYPE) {
    return calculator.calculate(ctx);
  }
  return calculator.calculateWithStrategy(ctx, strategy);
}
