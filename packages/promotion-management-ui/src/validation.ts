import type { PromotionWizardForm } from './types';

export type ValidationIssue = { field: string; message: string; severity: 'error' | 'warning' };

export function validatePromotionWizard(
  form: PromotionWizardForm,
  options?: { existingCodes?: string[]; editingId?: string }
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

  const hasTarget =
    form.targetScopes.includes('entire_platform') ||
    form.targetScopes.some((s) => (form.selectedTargets[s]?.length ?? 0) > 0);

  if (!hasTarget && form.createKind === 'promotion') {
    issues.push({
      field: 'target',
      message: 'Select at least one target scope',
      severity: 'error',
    });
  }

  if (
    form.targetScopes.includes('categories') &&
    !form.targetScopes.includes('entire_platform') &&
    (form.selectedTargets.categories?.length ?? 0) === 0
  ) {
    issues.push({
      field: 'target',
      message: 'Select at least one category',
      severity: 'error',
    });
  }

  const inventoryScopes: Array<keyof PromotionWizardForm['selectedTargets']> = [
    'services',
    'packages',
    'meal_plans',
    'products',
  ];
  const hasPartner = (form.selectedTargets.vendors?.length ?? 0) > 0;
  const hasInventory = inventoryScopes.some(
    (s) => (form.selectedTargets[s]?.length ?? 0) > 0
  );
  if (hasPartner && !hasInventory && form.targetScopes.includes('vendors')) {
    issues.push({
      field: 'target',
      message: 'Select at least one inventory item for the chosen vendor or seller',
      severity: 'error',
    });
  }

  return issues;
}

export function hasValidationErrors(issues: ValidationIssue[]): boolean {
  return issues.some((i) => i.severity === 'error');
}
