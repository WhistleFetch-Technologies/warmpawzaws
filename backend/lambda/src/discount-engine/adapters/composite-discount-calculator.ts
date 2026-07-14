import type { DiscountCalculator } from '../contracts/discount-calculator';
import type { DiscountContext } from '../models/discount-context';
import type { DiscountEngineResult } from '../models/discount-result';
import { emptyDiscountEngineResult } from '../models/discount-result';

/**
 * Routes calculation to the first registered adapter that supports the context.
 * Phase 4+ may compose multiple calculators (promotion + coupon paths).
 */
export class CompositeDiscountCalculator implements DiscountCalculator {
  readonly name = 'composite-discount-calculator';

  constructor(private readonly calculators: DiscountCalculator[]) {}

  supports(context: DiscountContext): boolean {
    return this.calculators.some((c) => c.supports(context));
  }

  async calculate(context: DiscountContext): Promise<DiscountEngineResult> {
    const calculator = this.calculators.find((c) => c.supports(context));
    if (!calculator) {
      return {
        ...emptyDiscountEngineResult(context.amount),
        warnings: [
          `No DiscountCalculator registered for domain=${context.domain} trigger=${context.trigger}`,
        ],
      };
    }
    return calculator.calculate(context);
  }
}

export function createCompositeDiscountCalculator(
  calculators: DiscountCalculator[]
): DiscountCalculator {
  return new CompositeDiscountCalculator(calculators);
}
