export type ValidationSeverity = 'error' | 'warning' | 'suggestion';

export interface ValidationFinding {
  severity: ValidationSeverity;
  ruleId: string;
  message: string;
  path?: string;
  suggestion?: string;
}

export interface ValidationResult {
  findings: ValidationFinding[];
  errors: ValidationFinding[];
  warnings: ValidationFinding[];
  suggestions: ValidationFinding[];
  isPublishable: boolean;
  validatedFingerprint?: string;
}

export function buildValidationResult(
  findings: ValidationFinding[],
  validatedFingerprint?: string
): ValidationResult {
  const errors = findings.filter((f) => f.severity === 'error');
  const warnings = findings.filter((f) => f.severity === 'warning');
  const suggestions = findings.filter((f) => f.severity === 'suggestion');
  return {
    findings,
    errors,
    warnings,
    suggestions,
    isPublishable: errors.length === 0,
    validatedFingerprint,
  };
}
