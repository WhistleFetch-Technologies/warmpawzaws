import {
  createCompositeDiscountCalculator,
  createLegacyEcommerceCartDiscountCalculator,
  createLegacyServiceDiscountCalculator,
} from '../adapters';
import type { DiscountEngineRegistry, PartialDiscountEngineRegistry } from './types';

let defaultRegistry: DiscountEngineRegistry | null = null;

/**
 * Builds the default registry with legacy adapters behind DiscountCalculator.
 * Future phases swap individual bindings without touching call sites.
 */
export function createDefaultDiscountEngineRegistry(
  overrides: PartialDiscountEngineRegistry = {} as PartialDiscountEngineRegistry
): DiscountEngineRegistry {
  const calculator =
    overrides.calculator ??
    createCompositeDiscountCalculator([
      createLegacyServiceDiscountCalculator(),
      createLegacyEcommerceCartDiscountCalculator(),
    ]);

  return {
    calculator,
    eligibilityEngine: overrides.eligibilityEngine,
    settlementEngine: overrides.settlementEngine,
    usageTracker: overrides.usageTracker,
    priorityEngine: overrides.priorityEngine,
    stackEngine: overrides.stackEngine,
    benefitStrategies: overrides.benefitStrategies,
  };
}

export function getDiscountEngineRegistry(): DiscountEngineRegistry {
  if (!defaultRegistry) {
    defaultRegistry = createDefaultDiscountEngineRegistry();
  }
  return defaultRegistry;
}

/** Test / bootstrap hook — replace default singleton. */
export function setDiscountEngineRegistry(registry: DiscountEngineRegistry): void {
  defaultRegistry = registry;
}

export function resetDiscountEngineRegistry(): void {
  defaultRegistry = null;
}
