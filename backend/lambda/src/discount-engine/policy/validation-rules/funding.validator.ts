import type { RuntimePolicy } from '../runtime-policy';
import type { PolicyValidator } from '../validator-registry';
import type { ValidationFinding } from '../validation-result';

export const fundingValidator: PolicyValidator = {
  id: 'funding',
  validate(policy: RuntimePolicy): ValidationFinding[] {
    const findings: ValidationFinding[] = [];
    const split = policy.funding.sharedDefaultSplit;
    const total = split.platformPercent + split.vendorPercent;
    if (Math.abs(total - 100) > 0.01) {
      findings.push({
        severity: 'error',
        ruleId: 'funding.split.invalid',
        message: `Shared funding split must sum to 100 (got ${total})`,
        path: 'funding.sharedDefaultSplit',
      });
    }
    if (split.platformPercent < 0 || split.vendorPercent < 0) {
      findings.push({
        severity: 'error',
        ruleId: 'funding.split.negative',
        message: 'Funding split percentages cannot be negative',
        path: 'funding.sharedDefaultSplit',
      });
    }
    return findings;
  },
};
