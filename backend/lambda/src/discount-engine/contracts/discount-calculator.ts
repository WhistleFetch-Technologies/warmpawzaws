import type { DiscountContext } from '../models/discount-context';
import type { DiscountEngineResult } from '../models/discount-result';

/**
 * Top-level calculator contract.
 * Legacy engines are wrapped via adapters implementing this interface.
 */
export interface DiscountCalculator {
  readonly name: string;
  supports(context: DiscountContext): boolean;
  calculate(context: DiscountContext): Promise<DiscountEngineResult>;
}
