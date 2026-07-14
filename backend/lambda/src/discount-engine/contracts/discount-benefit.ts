import type { DiscountContext } from '../models/discount-context';

export interface DiscountBenefitCalculation {
  amount: number;
  benefitType: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Contract for computing monetary benefit from an eligible discount.
 * Phase 3 will provide concrete benefit strategies.
 */
export interface DiscountBenefit {
  readonly benefitType: string;
  calculate(
    context: DiscountContext,
    eligibleAmount: number
  ): DiscountBenefitCalculation | Promise<DiscountBenefitCalculation>;
}
