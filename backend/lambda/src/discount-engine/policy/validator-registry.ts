import type { RuntimePolicy } from './runtime-policy';
import type { ValidationFinding } from './validation-result';

export interface PolicyValidator {
  readonly id: string;
  validate(policy: RuntimePolicy): ValidationFinding[];
}

export class ValidatorRegistry {
  private readonly validators = new Map<string, PolicyValidator>();

  register(validator: PolicyValidator): void {
    this.validators.set(validator.id, validator);
  }

  getAll(): PolicyValidator[] {
    return [...this.validators.values()];
  }
}

let defaultRegistry: ValidatorRegistry | null = null;

export function createValidatorRegistry(validators: PolicyValidator[]): ValidatorRegistry {
  const registry = new ValidatorRegistry();
  for (const v of validators) registry.register(v);
  return registry;
}

export function getDefaultValidatorRegistry(): ValidatorRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new ValidatorRegistry();
  }
  return defaultRegistry;
}

export function resetValidatorRegistryForTests(registry: ValidatorRegistry): void {
  defaultRegistry = registry;
}
