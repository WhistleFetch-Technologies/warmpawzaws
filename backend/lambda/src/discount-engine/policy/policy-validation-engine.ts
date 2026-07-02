import { duplicateRuleValidator } from './validation-rules/duplicate-rule.validator';
import { fundingValidator } from './validation-rules/funding.validator';
import { invalidLimitValidator } from './validation-rules/invalid-limit.validator';
import { schemaValidator } from './validation-rules/schema.validator';
import { stackConsistencyValidator } from './validation-rules/stack-consistency.validator';
import type { RuntimePolicy } from './runtime-policy';
import { computePolicyFingerprint } from './runtime-policy-fingerprint';
import {
  createValidatorRegistry,
  type ValidatorRegistry,
} from './validator-registry';
import { buildValidationResult, type ValidationResult } from './validation-result';

const BUILTIN_VALIDATORS = [
  schemaValidator,
  duplicateRuleValidator,
  invalidLimitValidator,
  stackConsistencyValidator,
  fundingValidator,
];

export function createDefaultPolicyValidationEngine(): PolicyValidationEngine {
  return new PolicyValidationEngine(createValidatorRegistry(BUILTIN_VALIDATORS));
}

export class PolicyValidationEngine {
  constructor(private readonly registry: ValidatorRegistry) {}

  validate(policy: RuntimePolicy): ValidationResult {
    const findings = this.registry.getAll().flatMap((v) => v.validate(policy));
    const fingerprint = computePolicyFingerprint(policy);
    return buildValidationResult(findings, fingerprint);
  }
}

let defaultEngine: PolicyValidationEngine | null = null;

export function getPolicyValidationEngine(): PolicyValidationEngine {
  if (!defaultEngine) {
    defaultEngine = createDefaultPolicyValidationEngine();
  }
  return defaultEngine;
}

export function resetPolicyValidationEngineForTests(): void {
  defaultEngine = createDefaultPolicyValidationEngine();
}
