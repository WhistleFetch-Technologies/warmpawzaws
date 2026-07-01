import { discountCalculationService } from '../../lib/services/discount-calculation-service';
import type { DiscountCalculator } from '../contracts/discount-calculator';
import { DiscountDomain } from '../enums/discount-domain';
import type { DiscountContext } from '../models/discount-context';
import type { DiscountEngineResult } from '../models/discount-result';
import { emptyDiscountEngineResult } from '../models/discount-result';
import {
  isServiceDomain,
  mapLegacyServiceResult,
  serviceContextToLegacyParams,
} from './context-mappers';

/**
 * Wraps legacy discount-calculation-service (vendor → platform → coupon stack).
 * Does not change calculation logic — delegates and maps the response shape.
 */
export class LegacyServiceDiscountCalculatorAdapter implements DiscountCalculator {
  readonly name = 'legacy-service-discount-calculator';

  supports(context: DiscountContext): boolean {
    return isServiceDomain(context) && Boolean(context.vendorId);
  }

  async calculate(context: DiscountContext): Promise<DiscountEngineResult> {
    if (!this.supports(context)) {
      return {
        ...emptyDiscountEngineResult(context.amount),
        warnings: ['LegacyServiceDiscountCalculatorAdapter: unsupported context'],
      };
    }

    const params = serviceContextToLegacyParams(context);
    const legacy = await discountCalculationService.calculateDiscounts(params);
    return mapLegacyServiceResult(legacy, context);
  }
}

export function createLegacyServiceDiscountCalculator(): DiscountCalculator {
  return new LegacyServiceDiscountCalculatorAdapter();
}
