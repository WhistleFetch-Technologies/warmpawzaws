import type { PromotionWizardForm, SmartTargetSurface, TargetScopeId } from './types';

export type ValidationIssue = { field: string; message: string; severity: 'error' | 'warning' };

const INVENTORY_SCOPES: TargetScopeId[] = [
  'services',
  'packages',
  'meal_plans',
  'products',
];

/** Concrete catalog picks — styles & categories count; entire_platform alone does not. */
export function hasConcreteTargetSelection(form: PromotionWizardForm): boolean {
  const selected = form.selectedTargets ?? {};
  if (INVENTORY_SCOPES.some((s) => (selected[s]?.length ?? 0) > 0)) return true;
  if ((selected.categories?.length ?? 0) > 0) return true;
  if ((selected.styles?.length ?? 0) > 0) return true;
  if ((selected.vendors?.length ?? 0) > 0 && INVENTORY_SCOPES.some((s) => (selected[s]?.length ?? 0) > 0)) {
    return true;
  }
  return false;
}

/**
 * "What does this apply to?" must be filled — never silently apply to all.
 * Vendors and admins (service + ecommerce) must pick scopes and concrete items.
 */
export function validatePromotionTargeting(
  form: PromotionWizardForm,
  options?: { audience?: 'admin' | 'vendor'; smartTargetSurface?: SmartTargetSurface }
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const audience = options?.audience ?? 'admin';
  const smartSurface = options?.smartTargetSurface;
  const scopes = form.targetScopes ?? [];
  const selected = form.selectedTargets ?? {};

  const isEcommerceAllProducts =
    smartSurface === 'ecommerce' &&
    (scopes.includes('all_products') ||
      (scopes.length === 1 && scopes.includes('entire_platform')));

  // Ecommerce "All Products" is an explicit shop-wide choice (maps to applicable_to products).
  if (isEcommerceAllProducts) {
    return issues;
  }

  const onlyEntirePlatform =
    scopes.length === 0 ||
    (scopes.length === 1 && scopes.includes('entire_platform'));

  if (onlyEntirePlatform || scopes.includes('entire_platform')) {
    issues.push({
      field: 'target',
      message:
        audience === 'vendor'
          ? 'Select what this applies to (services, packages, meal plans, products, or styles) — it cannot apply to everything by default.'
          : 'Select what this applies to (categories, vendors, services, products, or styles) — platform-wide “apply to all” is not allowed.',
      severity: 'error',
    });
    return issues;
  }

  if (scopes.length === 0) {
    issues.push({
      field: 'target',
      message: 'Select at least one target under “What does this apply to?”',
      severity: 'error',
    });
    return issues;
  }

  if (!hasConcreteTargetSelection(form)) {
    issues.push({
      field: 'target',
      message:
        audience === 'vendor'
          ? 'Choose items for the selected targets (e.g. pick services or service styles). Leaving this blank applies to all — that is not allowed.'
          : 'Choose at least one category, vendor inventory, product, service, or style. Leaving this blank applies to all — that is not allowed.',
      severity: 'error',
    });
  }

  // Admin marketing: category → catalogue services is required (applies to all vendors with those services).
  if (
    audience === 'admin' &&
    smartSurface === 'marketing' &&
    (selected.categories?.length ?? 0) > 0 &&
    (selected.services?.length ?? 0) === 0
  ) {
    issues.push({
      field: 'target',
      message:
        'Select at least one catalogue service under the chosen category. The offer applies for every vendor who published that service.',
      severity: 'error',
    });
  }

  for (const scope of scopes) {
    if (scope === 'entire_platform' || scope === 'all_products') continue;
    // Marketing categories: services are validated above (must pick catalogue services).
    if (
      audience === 'admin' &&
      smartSurface === 'marketing' &&
      scope === 'services' &&
      (selected.categories?.length ?? 0) > 0
    ) {
      continue;
    }
    const count = selected[scope]?.length ?? 0;
    if (count === 0) {
      const labels: Partial<Record<TargetScopeId, string>> = {
        services: 'service',
        packages: 'package',
        meal_plans: 'meal plan',
        products: 'product',
        categories: 'category',
        styles: 'service style',
        vendors: 'vendor',
        all_products: 'product',
      };
      issues.push({
        field: 'target',
        message: `Select at least one ${labels[scope] ?? scope.replace(/_/g, ' ')}`,
        severity: 'error',
      });
    }
  }

  const hasPartner = (selected.vendors?.length ?? 0) > 0;
  const hasInventory = INVENTORY_SCOPES.some((s) => (selected[s]?.length ?? 0) > 0);
  if (hasPartner && !hasInventory) {
    issues.push({
      field: 'target',
      message: 'Select at least one inventory item for the chosen vendor or seller',
      severity: 'error',
    });
  }

  return issues;
}

export function validatePromotionWizard(
  form: PromotionWizardForm,
  options?: {
    existingCodes?: string[];
    editingId?: string;
    audience?: 'admin' | 'vendor';
    smartTargetSurface?: SmartTargetSurface;
  }
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!form.name.trim()) {
    issues.push({ field: 'name', message: 'Name is required', severity: 'error' });
  }

  if (form.createKind === 'coupon') {
    if (!form.code?.trim()) {
      issues.push({ field: 'code', message: 'Coupon code is required', severity: 'error' });
    } else if (form.code.trim().length < 3) {
      issues.push({ field: 'code', message: 'Coupon code must be at least 3 characters', severity: 'error' });
    } else if (
      options?.existingCodes?.some(
        (c) => c.toUpperCase() === form.code!.trim().toUpperCase()
      )
    ) {
      issues.push({ field: 'code', message: 'This code may already exist', severity: 'warning' });
    }
  }

  if (form.discountValue <= 0) {
    issues.push({ field: 'discountValue', message: 'Discount value is required', severity: 'error' });
  }

  if (form.discountType === 'percentage' && form.discountValue > 100) {
    issues.push({ field: 'discountValue', message: 'Percentage cannot exceed 100%', severity: 'error' });
  }

  if (form.maxDiscount != null && form.maxDiscount < 0) {
    issues.push({ field: 'maxDiscount', message: 'Maximum discount cannot be negative', severity: 'error' });
  }

  if (form.minAmount != null && form.minAmount < 0) {
    issues.push({ field: 'minAmount', message: 'Minimum amount cannot be negative', severity: 'error' });
  }

  if (form.usageLimit != null && form.usageLimit < 1) {
    issues.push({ field: 'usageLimit', message: 'Usage limit must be at least 1', severity: 'error' });
  }

  if (form.usageLimitPerUser != null && form.usageLimitPerUser < 1) {
    issues.push({
      field: 'usageLimitPerUser',
      message: 'Per-customer limit must be at least 1',
      severity: 'error',
    });
  }

  if (!form.startDate || !form.endDate) {
    issues.push({ field: 'schedule', message: 'Start and end dates are required', severity: 'error' });
  } else if (new Date(form.endDate) < new Date(form.startDate)) {
    issues.push({ field: 'schedule', message: 'End date must be after start date', severity: 'error' });
  }

  issues.push(
    ...validatePromotionTargeting(form, {
      audience: options?.audience,
      smartTargetSurface: options?.smartTargetSurface,
    })
  );

  return issues;
}

export function hasValidationErrors(issues: ValidationIssue[]): boolean {
  return issues.some((i) => i.severity === 'error');
}
