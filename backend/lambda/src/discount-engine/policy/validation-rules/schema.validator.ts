import type { RuntimePolicy } from '../runtime-policy';
import type { PolicyValidator } from '../validator-registry';
import type { ValidationFinding } from '../validation-result';

export const schemaValidator: PolicyValidator = {
  id: 'schema',
  validate(policy: RuntimePolicy): ValidationFinding[] {
    const findings: ValidationFinding[] = [];
    if (!policy.priority?.global?.strategy) {
      findings.push({
        severity: 'error',
        ruleId: 'schema.priority.strategy',
        message: 'Priority strategy is required',
        path: 'priority.global.strategy',
      });
    }
    if (!policy.stack?.global?.stackOrder?.length) {
      findings.push({
        severity: 'error',
        ruleId: 'schema.stack.order',
        message: 'Stack order must not be empty',
        path: 'stack.global.stackOrder',
      });
    }
    if (!policy.limits?.global) {
      findings.push({
        severity: 'error',
        ruleId: 'schema.limits.global',
        message: 'Limit configuration global section is required',
        path: 'limits.global',
      });
    }
    return findings;
  },
};
