import type { PromotionTargetCatalog, PromotionWizardForm, TargetScopeId } from './types';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normalizeStyleToken(raw: string): string {
  const value = String(raw || '').trim().toLowerCase();
  if (!value || value === 'all') return '';
  if (value === 'home' || value === 'at_home' || value === 'home_visit') return 'at_home';
  if (value === 'clinic' || value === 'center' || value === 'at_center') return 'at_center';
  if (value === 'online' || value === 'tele') return 'tele';
  return value;
}

export function parseJsonArray(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((x) => String(x).trim()).filter(Boolean);
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map((x) => String(x).trim()).filter(Boolean) : [];
    } catch {
      return [raw.trim()].filter(Boolean);
    }
  }
  return [];
}

/** Build `applicable_services` tokens persisted on platform promotions. */
export function buildApplicableServicesFromForm(form: PromotionWizardForm): string[] {
  if (form.targetScopes.includes('entire_platform')) return [];

  const tokens: string[] = [];

  for (const cat of form.selectedTargets.categories ?? []) {
    const id = String(cat).trim().toLowerCase();
    if (id && id !== 'all') tokens.push(id);
  }
  for (const style of form.selectedTargets.styles ?? []) {
    const normalized = normalizeStyleToken(style);
    if (normalized) tokens.push(`style:${normalized}`);
  }
  for (const id of form.selectedTargets.services ?? []) {
    if (id) tokens.push(String(id));
  }
  for (const id of form.selectedTargets.packages ?? []) {
    if (id) tokens.push(String(id));
  }
  for (const id of form.selectedTargets.meal_plans ?? []) {
    if (id) tokens.push(String(id));
  }
  for (const id of form.selectedTargets.products ?? []) {
    if (id) tokens.push(String(id));
  }

  return Array.from(new Set(tokens));
}

export type ParsedPromotionTargets = {
  targetScopes: TargetScopeId[];
  selectedTargets: Partial<Record<TargetScopeId, string[]>>;
  primaryCategory?: string;
  primaryStyle?: string;
};

export function parseApplicableServicesToTargets(
  row: Record<string, unknown>,
  catalog?: PromotionTargetCatalog
): ParsedPromotionTargets {
  const meta =
    row.metadata && typeof row.metadata === 'object'
      ? (row.metadata as Record<string, unknown>)
      : {};
  const promotionTarget =
    meta.promotionTarget && typeof meta.promotionTarget === 'object'
      ? (meta.promotionTarget as Record<string, unknown>)
      : {};

  const storedScopes = parseJsonArray(
    promotionTarget.targetScopes ?? meta.targetScopes ?? row.target_scopes
  ) as TargetScopeId[];
  const storedTargets =
    (promotionTarget.selectedTargets as Partial<Record<TargetScopeId, string[]>>) ??
    (meta.selectedTargets as Partial<Record<TargetScopeId, string[]>>) ??
    (row.selected_targets as Partial<Record<TargetScopeId, string[]>>);

  if (storedScopes.length > 0 || (storedTargets && Object.keys(storedTargets).length > 0)) {
    const scopes =
      storedScopes.length > 0
        ? storedScopes
        : inferScopesFromSelectedTargets(storedTargets ?? {});
    return {
      targetScopes: scopes,
      selectedTargets: storedTargets ?? {},
      primaryCategory: String(row.service_category ?? row.serviceCategory ?? '').trim() || undefined,
      primaryStyle: normalizeStyleToken(
        String(row.service_style ?? row.serviceStyle ?? '')
      ) || undefined,
    };
  }

  const applicableIds = parseJsonArray(row.applicable_services ?? row.applicableServices);
  const productIds = parseJsonArray(row.applicable_products ?? row.applicableProducts);
  const categoryIds = parseJsonArray(
    row.applicable_categories ?? row.applicableCategories ?? row.applicable_category_ids
  );
  const vendorIds = parseJsonArray(row.vendor_ids ?? row.vendorIds ?? row.applicable_vendors);
  const styleFromColumn = normalizeStyleToken(
    String(row.service_style ?? row.serviceStyle ?? promotionTarget.serviceStyle ?? '')
  );

  if (
    applicableIds.length === 0 &&
    productIds.length === 0 &&
    categoryIds.length === 0 &&
    vendorIds.length === 0 &&
    !styleFromColumn &&
    (row.applicable_to === 'all' || !row.applicable_to)
  ) {
    return {
      targetScopes: ['entire_platform'],
      selectedTargets: {},
    };
  }

  const packageIdSet = new Set((catalog?.packages ?? []).map((x) => x.id));
  const serviceIdSet = new Set((catalog?.services ?? []).map((x) => x.id));
  const mealPlanIdSet = new Set((catalog?.mealPlans ?? []).map((x) => x.id));
  const productIdSet = new Set((catalog?.products ?? []).map((x) => x.id));
  const categoryIdSet = new Set((catalog?.categories ?? []).map((x) => x.id));

  const categories: string[] = [...categoryIds];
  const styles: string[] = styleFromColumn ? [styleFromColumn] : [];
  const services: string[] = [];
  const packages: string[] = [];
  const mealPlans: string[] = [];
  const products: string[] = [...productIds];

  for (const token of applicableIds) {
    if (token.startsWith('style:')) {
      const s = normalizeStyleToken(token.replace(/^style:/, ''));
      if (s) styles.push(s);
      continue;
    }
    if (UUID_RE.test(token)) {
      if (packageIdSet.has(token)) packages.push(token);
      else if (mealPlanIdSet.has(token)) mealPlans.push(token);
      else if (productIdSet.has(token)) products.push(token);
      else if (serviceIdSet.has(token)) services.push(token);
      else services.push(token);
      continue;
    }
    const lower = token.toLowerCase();
    if (categoryIdSet.has(lower) || categoryIdSet.has(token)) {
      categories.push(categoryIdSet.has(token) ? token : lower);
    } else {
      categories.push(lower);
    }
  }

  const legacyCategory = String(
    row.service_category ?? row.serviceCategory ?? promotionTarget.serviceCategory ?? ''
  )
    .trim()
    .toLowerCase();
  if (legacyCategory && legacyCategory !== 'all' && !categories.includes(legacyCategory)) {
    categories.push(legacyCategory);
  }

  const selectedTargets: Partial<Record<TargetScopeId, string[]>> = {};
  if (categories.length) selectedTargets.categories = Array.from(new Set(categories));
  if (styles.length) selectedTargets.styles = Array.from(new Set(styles));
  if (services.length) selectedTargets.services = Array.from(new Set(services));
  if (packages.length) selectedTargets.packages = Array.from(new Set(packages));
  if (mealPlans.length) selectedTargets.meal_plans = Array.from(new Set(mealPlans));
  if (products.length) selectedTargets.products = Array.from(new Set(products));
  if (vendorIds.length) selectedTargets.vendors = Array.from(new Set(vendorIds));

  const targetScopes = inferScopesFromSelectedTargets(selectedTargets);

  return {
    targetScopes,
    selectedTargets,
    primaryCategory: categories[0] ?? (legacyCategory || undefined),
    primaryStyle: styles[0] ?? (styleFromColumn || undefined),
  };
}

function inferScopesFromSelectedTargets(
  selected: Partial<Record<TargetScopeId, string[]>>
): TargetScopeId[] {
  const scopes: TargetScopeId[] = [];
  if ((selected.categories?.length ?? 0) > 0) scopes.push('categories');
  if ((selected.styles?.length ?? 0) > 0) scopes.push('styles');
  if ((selected.services?.length ?? 0) > 0) scopes.push('services');
  if ((selected.packages?.length ?? 0) > 0) scopes.push('packages');
  if ((selected.meal_plans?.length ?? 0) > 0) scopes.push('meal_plans');
  if ((selected.products?.length ?? 0) > 0) scopes.push('products');
  if ((selected.vendors?.length ?? 0) > 0) scopes.push('vendors');
  if (scopes.length === 0) scopes.push('entire_platform');
  return scopes;
}

export function summarizeTargetsFromRow(
  row: Record<string, unknown>,
  catalog?: PromotionTargetCatalog,
  options?: { vendorMode?: boolean }
): string {
  if (row.applicable_to === 'all') {
    return options?.vendorMode ? 'All services' : 'Entire marketplace';
  }

  const parsed = parseApplicableServicesToTargets(row, catalog);
  if (parsed.targetScopes.includes('entire_platform')) {
    return options?.vendorMode ? 'All services' : 'Entire marketplace';
  }

  const parts: string[] = [];
  const scopeLabels: Record<TargetScopeId, string> = {
    entire_platform: 'Entire marketplace',
    categories: 'categories',
    services: 'services',
    packages: 'packages',
    meal_plans: 'meal plans',
    products: 'products',
    vendors: 'vendors',
    styles: 'service styles',
  };

  const labelIds = (scope: TargetScopeId, ids?: string[]) => {
    if (!ids?.length) return;
    if (scope === 'categories' && ids.length === 1) {
      const name = catalog?.categories?.find((o) => o.id === ids[0])?.label ?? ids[0];
      parts.push(`Entire ${name} category`);
      return;
    }
    const catalogOptions =
      scope === 'categories'
        ? catalog?.categories
        : scope === 'services'
          ? catalog?.services
          : scope === 'packages'
            ? catalog?.packages
            : scope === 'meal_plans'
              ? catalog?.mealPlans
              : scope === 'products'
                ? catalog?.products
                : scope === 'vendors'
                  ? catalog?.vendors
                  : scope === 'styles'
                    ? catalog?.styles
                    : undefined;
    if (catalogOptions?.length) {
      const names = ids
        .map((id) => catalogOptions.find((o) => o.id === id)?.label)
        .filter(Boolean)
        .slice(0, 2);
      if (names.length) {
        parts.push(
          `${ids.length} ${scopeLabels[scope]} (${names.join(', ')}${ids.length > names.length ? ` +${ids.length - names.length}` : ''})`
        );
        return;
      }
    }
    parts.push(`${ids.length} ${scopeLabels[scope]}`);
  };

  labelIds('categories', parsed.selectedTargets.categories);
  labelIds('services', parsed.selectedTargets.services);
  labelIds('packages', parsed.selectedTargets.packages);
  labelIds('meal_plans', parsed.selectedTargets.meal_plans);
  labelIds('products', parsed.selectedTargets.products);
  labelIds('vendors', parsed.selectedTargets.vendors);
  labelIds('styles', parsed.selectedTargets.styles);

  return parts.length ? parts.join(' · ') : 'Custom targets';
}
