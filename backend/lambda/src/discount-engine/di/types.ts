import type { DiscountBenefit } from '../contracts/discount-benefit';
import type { DiscountCalculator } from '../contracts/discount-calculator';
import type { EligibilityEngine } from '../contracts/eligibility-engine';
import type { PriorityEngine } from '../contracts/priority-engine';
import type { SettlementEngine } from '../contracts/settlement-engine';
import type { StackEngine } from '../contracts/stack-engine';
import type { UsageTracker } from '../contracts/usage-tracker';

/**
 * Registry of discount engine collaborators.
 * Unset slots are optional until their phase is implemented.
 */
export interface DiscountEngineRegistry {
  calculator: DiscountCalculator;
  eligibilityEngine?: EligibilityEngine;
  settlementEngine?: SettlementEngine;
  usageTracker?: UsageTracker;
  priorityEngine?: PriorityEngine;
  stackEngine?: StackEngine;
  benefitStrategies?: DiscountBenefit[];
}

export type PartialDiscountEngineRegistry = Partial<DiscountEngineRegistry> & {
  calculator: DiscountCalculator;
};
