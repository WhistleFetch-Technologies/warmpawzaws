type TargetScopes = string[] | undefined;
type SelectedTargets = Record<string, string[] | undefined> | undefined;

export type PromotionTargetingInput = {
  target_scopes?: TargetScopes;
  targetScopes?: TargetScopes;
  selected_targets?: SelectedTargets;
  selectedTargets?: SelectedTargets;
  applicable_services?: unknown;
  applicableServices?: unknown;
  service_category?: string | null;
  serviceCategory?: string | null;
};

const INVENTORY_KEYS = ['services', 'packages', 'meal_plans', 'products'] as const;

function scopes(body: PromotionTargetingInput): string[] {
  return body.target_scopes ?? body.targetScopes ?? [];
}

function targets(body: PromotionTargetingInput): Record<string, string[] | undefined> {
  return (body.selected_targets ?? body.selectedTargets ?? {}) as Record<string, string[] | undefined>;
}

function hasInventorySelection(selected: Record<string, string[] | undefined>): boolean {
  return INVENTORY_KEYS.some((key) => (selected[key]?.length ?? 0) > 0);
}

function hasStyleSelection(selected: Record<string, string[] | undefined>): boolean {
  return (selected.styles?.length ?? 0) > 0;
}

function hasCategorySelection(selected: Record<string, string[] | undefined>): boolean {
  return (selected.categories?.length ?? 0) > 0;
}

function hasApplicableServicesList(body: PromotionTargetingInput): boolean {
  const parsed = body.applicable_services ?? body.applicableServices;
  return Array.isArray(parsed) && parsed.length > 0;
}

function isUnscopedPlatformWide(
  scopeList: string[],
  selected: Record<string, string[] | undefined>,
  body: PromotionTargetingInput
): boolean {
  const onlyEntirePlatform =
    scopeList.length === 0 ||
    (scopeList.length === 1 && scopeList[0] === 'entire_platform') ||
    scopeList.includes('entire_platform');

  if (!onlyEntirePlatform) return false;

  const hasCategory = hasCategorySelection(selected);
  const hasVendor = (selected.vendors?.length ?? 0) > 0;
  const hasInventory = hasInventorySelection(selected);
  const hasStyles = hasStyleSelection(selected);
  const hasServiceCategory = Boolean(
    String(body.service_category ?? body.serviceCategory ?? '').trim()
  );
  const hasApplicableServices = hasApplicableServicesList(body);

  return (
    !hasCategory &&
    !hasVendor &&
    !hasInventory &&
    !hasStyles &&
    !hasApplicableServices &&
    !hasServiceCategory
  );
}

/**
 * Admin marketplace / ecommerce promos & coupons must never default to “apply to all”.
 * Require explicit category, vendor+inventory, styles, or inventory selections.
 */
export function validateAdminPromotionTargeting(body: PromotionTargetingInput): string | null {
  const scopeList = scopes(body);
  const selected = targets(body);

  if (isUnscopedPlatformWide(scopeList, selected, body)) {
    return 'Select what this applies to (categories, vendors, services, products, or styles) — platform-wide “apply to all” is not allowed.';
  }

  if (scopeList.includes('entire_platform') && !hasConcreteAdminTargets(selected, body)) {
    return 'Select at least one category or vendor inventory — platform-wide offers must be scoped.';
  }

  for (const scope of scopeList) {
    if (scope === 'entire_platform') continue;
    if ((selected[scope]?.length ?? 0) === 0 && scope !== 'vendors') {
      // vendors can be paired with inventory under other keys
      if (['services', 'packages', 'meal_plans', 'products', 'categories', 'styles'].includes(scope)) {
        return `Select at least one ${scope.replace(/_/g, ' ')}.`;
      }
    }
  }

  if (scopeList.includes('categories') && !hasCategorySelection(selected)) {
    return 'Select at least one category.';
  }

  // Category + services scope ⇒ catalogue services must be chosen (apply across vendors).
  if (
    hasCategorySelection(selected) &&
    scopeList.includes('services') &&
    (selected.services?.length ?? 0) === 0 &&
    !hasApplicableServicesList(body)
  ) {
    return 'Select at least one catalogue service under the chosen category. The offer applies for every vendor who published that service.';
  }

  const hasVendor = (selected.vendors?.length ?? 0) > 0;
  if (hasVendor && !hasInventorySelection(selected) && !hasApplicableServicesList(body)) {
    return 'Select at least one inventory item for the chosen vendor or seller.';
  }

  if (!hasConcreteAdminTargets(selected, body)) {
    return 'Select at least one category, service, product, package, meal plan, or style. Leaving this blank applies to all — that is not allowed.';
  }

  return null;
}

function hasConcreteAdminTargets(
  selected: Record<string, string[] | undefined>,
  body: PromotionTargetingInput
): boolean {
  return (
    hasCategorySelection(selected) ||
    hasInventorySelection(selected) ||
    hasStyleSelection(selected) ||
    hasApplicableServicesList(body) ||
    Boolean(String(body.service_category ?? body.serviceCategory ?? '').trim()) ||
    ((selected.vendors?.length ?? 0) > 0 && hasInventorySelection(selected))
  );
}

/**
 * Vendor promos/coupons must target services / packages / meal plans / products / styles.
 * Empty targeting must NOT silently apply to all.
 */
export function validateVendorPromotionTargeting(body: PromotionTargetingInput): string | null {
  const scopeList = scopes(body);
  const selected = targets(body);

  if (isUnscopedPlatformWide(scopeList, selected, body)) {
    return 'Select what this applies to (services, packages, meal plans, products, or styles) — it cannot apply to everything by default.';
  }

  for (const scope of scopeList) {
    if (scope === 'entire_platform') continue;
    if (
      ['services', 'packages', 'meal_plans', 'products', 'categories', 'styles'].includes(scope) &&
      (selected[scope]?.length ?? 0) === 0
    ) {
      return `Select at least one ${scope.replace(/_/g, ' ')}.`;
    }
  }

  const hasCategory = hasCategorySelection(selected);
  const hasInventory = hasInventorySelection(selected);
  const hasStyles = hasStyleSelection(selected);
  const hasApplicableServices = hasApplicableServicesList(body);

  if (!hasCategory && !hasInventory && !hasStyles && !hasApplicableServices) {
    return 'Select at least one service, package, meal plan, product, or service style for this offer.';
  }

  return null;
}
