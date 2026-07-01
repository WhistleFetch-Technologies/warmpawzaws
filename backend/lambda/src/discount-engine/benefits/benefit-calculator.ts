import type { BenefitCalculator, BenefitContext, BenefitResult, BenefitStrategy } from './types';
import {
  BogoBenefitStrategy,
  BundleBenefitStrategy,
  ComboBenefitStrategy,
  FlatBenefitStrategy,
  LoyaltyBenefitStrategy,
  PercentageBenefitStrategy,
} from './strategies';

const EMPTY_RESULT = (ctx: BenefitContext): BenefitResult => ({
  discountAmount: 0,
  finalAmount: ctx.originalAmount,
  appliedBenefit: 'none',
});

export class DefaultBenefitCalculator implements BenefitCalculator {
  readonly strategies: BenefitStrategy[];

  constructor(strategies?: BenefitStrategy[]) {
    this.strategies = strategies ?? [
      new BogoBenefitStrategy(),
      new BundleBenefitStrategy(),
      new ComboBenefitStrategy(),
      new LoyaltyBenefitStrategy(),
      new PercentageBenefitStrategy(),
      new FlatBenefitStrategy(),
    ];
  }

  calculate(context: BenefitContext): BenefitResult {
    const strategy = this.strategies.find((s) => s.supports(context));
    if (!strategy) {
      return EMPTY_RESULT(context);
    }
    return strategy.calculate(context);
  }

  calculateWithStrategy(context: BenefitContext, benefitType: string): BenefitResult {
    const strategy = this.strategies.find((s) => s.benefitType === benefitType);
    if (!strategy) {
      return EMPTY_RESULT(context);
    }
    return strategy.calculate(context);
  }
}

let defaultCalculator: BenefitCalculator | null = null;

export function getBenefitCalculator(): BenefitCalculator {
  if (!defaultCalculator) {
    defaultCalculator = new DefaultBenefitCalculator();
  }
  return defaultCalculator;
}

export function setBenefitCalculator(calculator: BenefitCalculator): void {
  defaultCalculator = calculator;
}

export function resetBenefitCalculator(): void {
  defaultCalculator = null;
}
