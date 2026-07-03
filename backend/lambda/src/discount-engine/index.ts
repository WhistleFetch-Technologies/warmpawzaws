export * from './enums';
export * from './models';
export * from './adapters';
export * from './di';
export * from './benefits';
export * from './rules';
export * from './candidates';
export * from './resolver';
export * from './priority';
export * from './policy';
export * from './config/types';

// Phase 1 contracts — aliased where implementation modules use the same name.
export type {
  DiscountRuleEvaluation,
  DiscountBenefitCalculation,
  DiscountCalculator,
  EligibilityEngine,
  SettlementEngine,
  UsageTracker,
  RecordDiscountUsageParams,
  CountDiscountUsageParams,
  PrioritizedDiscount,
  StackEngine,
  StackPolicy,
} from './contracts';
export type { DiscountRule as ContractDiscountRule } from './contracts/discount-rule';
export type { DiscountBenefit as ContractDiscountBenefit } from './contracts/discount-benefit';
export type { PriorityEngine as PriorityEngineContract } from './contracts/priority-engine';
export * from './analytics';
