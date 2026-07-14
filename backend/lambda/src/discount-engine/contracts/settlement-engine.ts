import type { DiscountContext } from '../models/discount-context';
import type { DiscountEngineResult, DiscountSettlementPreview } from '../models/discount-result';

/**
 * Settlement contract — NOT implemented in Phase 1.
 * Finance / payout modules will consume this in Phase 7.
 */
export interface SettlementEngine {
  compute(
    context: DiscountContext,
    result: DiscountEngineResult
  ): Promise<DiscountSettlementPreview> | DiscountSettlementPreview;
}
