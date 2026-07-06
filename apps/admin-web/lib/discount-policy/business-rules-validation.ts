/**
 * Client-side business rules validation — mirrors backend PolicyValidationEngine intent.
 * Used when POST /admin/discount-policy/validate is unavailable.
 */
import { ensureBusinessRules } from './business-rules-mapper';
import type { BusinessRulesConfiguration } from './business-rules-types';
import type { DiscountPolicyBundle, ValidationFinding, ValidationResult } from './types';

function finding(
  severity: ValidationFinding['severity'],
  ruleId: string,
  message: string,
  path?: string,
  suggestion?: string
): ValidationFinding {
  return { severity, ruleId, message, path, suggestion };
}

export function validateBusinessRulesLocally(bundle: DiscountPolicyBundle): ValidationResult {
  const rules = ensureBusinessRules(bundle);
  const findings: ValidationFinding[] = [];

  if (rules.applicationStrategy === 'BEST_OFFER_ONLY') {
    if (!rules.winningStrategy) {
      findings.push(
        finding(
          'error',
          'businessRules.missingWinningStrategy',
          'Winning Offer Strategy is required when Discount Application Strategy is Apply Best Offer Only.',
          'businessRules.winningStrategy',
          'Select a Winning Offer Strategy on the Winning Offer tab.'
        )
      );
    }

    if (rules.winningStrategy === 'CUSTOM_PRIORITY') {
      validateCustomPriorityOrder(rules, findings);
    }

    const enabledCombos = rules.combinationMatrix.filter((r) => r.allowed);
    if (enabledCombos.length > 0) {
      findings.push(
        finding(
          'warning',
          'businessRules.matrix.bestOfferOnly',
          'Offer combination rules are ignored when Apply Best Offer Only is active — combinations are resolved by the Winning Offer Strategy.',
          'businessRules.combinationMatrix'
        )
      );
    }
  }

  if (rules.applicationStrategy === 'STACK_ELIGIBLE') {
    validateStackMatrix(rules, findings);
  }

  if (rules.applicationStrategy === 'CUSTOM_RULES') {
    findings.push(
      finding(
        'suggestion',
        'businessRules.customRules',
        'Custom Rules mode uses advanced stack configuration. Review engine stack rules before publishing.',
        'businessRules.applicationStrategy'
      )
    );
  }

  validateOfferTypes(rules, findings);

  const errors = findings.filter((f) => f.severity === 'error');
  const warnings = findings.filter((f) => f.severity === 'warning');
  const suggestions = findings.filter((f) => f.severity === 'suggestion');

  return {
    findings,
    errors,
    warnings,
    suggestions,
    isPublishable: errors.length === 0,
    validatedFingerprint: `local-${Date.now().toString(36)}`,
  };
}

function validateCustomPriorityOrder(
  rules: BusinessRulesConfiguration,
  findings: ValidationFinding[]
): void {
  const order = rules.customPriorityOrder;
  if (!order.length) {
    findings.push(
      finding(
        'error',
        'businessRules.emptyCustomPriority',
        'Custom Priority order is empty. Drag offer types into a priority order.',
        'businessRules.customPriorityOrder'
      )
    );
    return;
  }

  const seen = new Set<string>();
  for (const key of order) {
    if (seen.has(key)) {
      findings.push(
        finding(
          'error',
          'businessRules.duplicatePriority',
          `Duplicate priority entry: ${key}. Each offer type may appear only once.`,
          'businessRules.customPriorityOrder'
        )
      );
    }
    seen.add(key);
  }

  const knownKeys = new Set(rules.offerTypes.map((o) => o.key));
  for (const key of order) {
    if (!knownKeys.has(key)) {
      findings.push(
        finding(
          'error',
          'businessRules.unknownOfferType',
          `Unknown offer type in priority order: ${key}.`,
          'businessRules.customPriorityOrder'
        )
      );
    }
  }
}

function validateStackMatrix(
  rules: BusinessRulesConfiguration,
  findings: ValidationFinding[]
): void {
  const allowed = rules.combinationMatrix.filter((r) => r.allowed);
  if (allowed.length === 0) {
    findings.push(
      finding(
        'warning',
        'businessRules.matrix.noCombinations',
        'No offer combinations are enabled. Customers will receive at most one discount unless Apply Best Offer Only is selected.',
        'businessRules.combinationMatrix',
        'Enable combinations that business allows to stack.'
      )
    );
  }

  for (const rule of rules.combinationMatrix) {
    if (rule.left === rule.right) {
      findings.push(
        finding(
          'error',
          'businessRules.matrix.selfPair',
          `Invalid combination: ${rule.left} cannot combine with itself.`,
          `businessRules.combinationMatrix.${rule.id}`
        )
      );
    }
  }

  const vpPp = rules.combinationMatrix.find(
    (r) =>
      (r.left === 'VENDOR_PROMOTION' && r.right === 'PLATFORM_PROMOTION') ||
      (r.left === 'PLATFORM_PROMOTION' && r.right === 'VENDOR_PROMOTION')
  );
  if (vpPp?.allowed && !rules.combinationMatrix.some((r) => r.allowed && r.id !== vpPp.id)) {
    findings.push(
      finding(
        'suggestion',
        'businessRules.matrix.singleCombo',
        'Only vendor + platform promotion stacking is enabled. Consider enabling coupon combinations if needed.',
        'businessRules.combinationMatrix'
      )
    );
  }
}

function validateOfferTypes(
  rules: BusinessRulesConfiguration,
  findings: ValidationFinding[]
): void {
  const keys = rules.offerTypes.map((o) => o.key);
  const dupKeys = keys.filter((k, i) => keys.indexOf(k) !== i);
  if (dupKeys.length) {
    findings.push(
      finding(
        'error',
        'businessRules.duplicateOfferTypes',
        `Duplicate offer type keys: ${[...new Set(dupKeys)].join(', ')}.`,
        'businessRules.offerTypes'
      )
    );
  }
}
