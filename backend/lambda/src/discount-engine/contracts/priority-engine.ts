import type { AppliedDiscount } from '../models/discount-result';

export interface PrioritizedDiscount extends AppliedDiscount {
  priority: number;
  exclusive?: boolean;
}

/**
 * Sorts and filters discounts by priority rules.
 * Phase 5 will replace legacy "highest discount wins" logic.
 */
export interface PriorityEngine {
  prioritize(candidates: PrioritizedDiscount[]): PrioritizedDiscount[];
}
