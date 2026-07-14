import type { RuntimePolicy } from '../runtime-policy';
import type { PolicyValidator } from '../validator-registry';
import type { ValidationFinding } from '../validation-result';

export const stackConsistencyValidator: PolicyValidator = {
  id: 'stack-consistency',
  validate(policy: RuntimePolicy): ValidationFinding[] {
    const findings: ValidationFinding[] = [];
    const { stack } = policy;

    if (stack.global.exclusiveTerminatesAll) {
      const allowsMultiExclusive = stack.global.stackRules.some(
        (r) =>
          r.left.source === 'EXCLUSIVE' &&
          r.right.source === 'EXCLUSIVE' &&
          r.allowed
      );
      if (allowsMultiExclusive) {
        findings.push({
          severity: 'error',
          ruleId: 'stack.exclusive.conflict',
          message:
            'exclusiveTerminatesAll is true but stack rules allow Exclusive + Exclusive',
          path: 'stack.global.exclusiveTerminatesAll',
        });
      }
    }

    for (const rule of stack.global.stackRules) {
      for (const src of [rule.left.source, rule.right.source]) {
        if (
          src &&
          !stack.global.stackOrder.includes(String(src)) &&
          src !== 'EXCLUSIVE'
        ) {
          findings.push({
            severity: 'warning',
            ruleId: 'stack.order.unknownSource',
            message: `Stack rule ${rule.id} references source not in stackOrder: ${src}`,
            path: `stack.global.stackRules.${rule.id}`,
          });
        }
      }
    }

    return findings;
  },
};
