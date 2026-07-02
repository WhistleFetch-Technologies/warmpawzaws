import type { PriorityStrategyKey } from '../config/types';
import type { PriorityStrategy } from './priority-types';
import { fixedPriorityStrategy } from './strategies/fixed-priority.strategy';
import { lowestPlatformCostStrategy } from './strategies/lowest-platform-cost.strategy';
import { maxCustomerSavingsStrategy } from './strategies/max-customer-savings.strategy';
import {
  adminManualOrderStrategy,
  vendorSpotlightStrategy,
} from './strategies/vendor-spotlight.strategy';

export class StrategyRegistry {
  private readonly strategies = new Map<PriorityStrategyKey, PriorityStrategy>();

  register(strategy: PriorityStrategy): void {
    this.strategies.set(strategy.key, strategy);
  }

  get(key: PriorityStrategyKey): PriorityStrategy {
    const strategy = this.strategies.get(key);
    if (!strategy) {
      return this.strategies.get('MAX_CUSTOMER_SAVINGS')!;
    }
    return strategy;
  }

  getAll(): PriorityStrategy[] {
    return [...this.strategies.values()];
  }
}

export function createDefaultStrategyRegistry(): StrategyRegistry {
  const registry = new StrategyRegistry();
  registry.register(maxCustomerSavingsStrategy);
  registry.register(vendorSpotlightStrategy);
  registry.register(fixedPriorityStrategy);
  registry.register(lowestPlatformCostStrategy);
  registry.register(adminManualOrderStrategy);
  return registry;
}

let defaultRegistry: StrategyRegistry | null = null;

export function getStrategyRegistry(): StrategyRegistry {
  if (!defaultRegistry) {
    defaultRegistry = createDefaultStrategyRegistry();
  }
  return defaultRegistry;
}

export function resetStrategyRegistryForTests(registry?: StrategyRegistry): void {
  defaultRegistry = registry ?? createDefaultStrategyRegistry();
}
