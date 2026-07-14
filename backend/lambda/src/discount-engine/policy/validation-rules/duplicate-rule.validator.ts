import type { RuntimePolicy } from '../runtime-policy';
import type { PolicyValidator } from '../validator-registry';
import type { ValidationFinding } from '../validation-result';

export const duplicateRuleValidator: PolicyValidator = {
  id: 'duplicate-rule-ids',
  validate(policy: RuntimePolicy): ValidationFinding[] {
    const findings: ValidationFinding[] = [];
    const ids = policy.stack.global.stackRules.map((r) => r.id);
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) {
        findings.push({
          severity: 'error',
          ruleId: 'duplicate.stackRuleId',
          message: `Duplicate stack rule id: ${id}`,
          path: `stack.global.stackRules`,
        });
      }
      seen.add(id);
    }
    return findings;
  },
};
