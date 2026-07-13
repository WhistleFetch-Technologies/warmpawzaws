import type {
  PromotionTargetCatalog,
  PromotionWizardForm,
  PromotionTypeId,
  SmartTargetCatalogAdapter,
  TargetOption,
  TargetScopeId,
  VendorInventoryType,
} from './types';

const ITEM_LEVEL_SCOPES: TargetScopeId[] = ['services', 'packages', 'meal_plans', 'products'];

const SCOPE_LABELS: Record<TargetScopeId, string> = {
  entire_platform: 'platform',
  all_products: 'all products',
  vendors: 'vendors',
  categories: 'categories',
  services: 'services',
  packages: 'packages',
  meal_plans: 'meal plans',
  products: 'products',
  styles: 'styles',
};

const SIMPLE_DISCOUNT_TYPES: PromotionTypeId[] = [
  'percentage',
  'flat',
  'flash_sale',
  'seasonal',
  'category_discount',
  'first_order',
  'first_booking',
  'loyalty',
];

export type SelectedTargetPreview = {
  id: string;
  label: string;
  scope: TargetScopeId;
  price?: number;
};

export function formatInr(amount: number): string {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

export function parsePriceFromSubtitle(subtitle?: string): number | undefined {
  if (!subtitle) return undefined;
  const match = subtitle.match(/₹\s*([\d,]+(?:\.\d+)?)/);
  if (!match) return undefined;
  const n = Number(match[1].replace(/,/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

export function resolveTargetPrice(option: TargetOption): number | undefined {
  if (option.price != null && Number.isFinite(option.price)) return option.price;
  return parsePriceFromSubtitle(option.subtitle);
}

export function supportsSimplePricePreview(promotionType: PromotionTypeId): boolean {
  return SIMPLE_DISCOUNT_TYPES.includes(promotionType);
}

export function estimateDiscountedPrice(
  originalPrice: number,
  form: Pick<PromotionWizardForm, 'discountType' | 'discountValue' | 'maxDiscount'>
): number {
  if (originalPrice <= 0 || form.discountValue <= 0) return originalPrice;

  let discountAmount = 0;
  if (form.discountType === 'percentage') {
    discountAmount = (originalPrice * form.discountValue) / 100;
    if (form.maxDiscount != null && form.maxDiscount > 0) {
      discountAmount = Math.min(discountAmount, form.maxDiscount);
    }
  } else {
    discountAmount = form.discountValue;
  }

  return Math.max(0, originalPrice - discountAmount);
}

function catalogForScope(
  scope: TargetScopeId,
  catalog: PromotionTargetCatalog
): TargetOption[] | undefined {
  switch (scope) {
    case 'services':
      return catalog.services;
    case 'packages':
      return catalog.packages;
    case 'meal_plans':
      return catalog.mealPlans;
    case 'products':
      return catalog.products;
    default:
      return undefined;
  }
}

function catalogKeyForScope(scope: TargetScopeId): keyof PromotionTargetCatalog | undefined {
  switch (scope) {
    case 'services':
      return 'services';
    case 'packages':
      return 'packages';
    case 'meal_plans':
      return 'mealPlans';
    case 'products':
      return 'products';
    default:
      return undefined;
  }
}

/** Merge lazily loaded target rows (e.g. seller products) into a base catalog for preview. */
export function mergeCatalogWithResolvedOptions(
  catalog: PromotionTargetCatalog | undefined,
  resolved: Partial<Record<TargetScopeId, TargetOption[]>>
): PromotionTargetCatalog {
  const merged: PromotionTargetCatalog = { ...(catalog ?? {}) };

  for (const scope of ITEM_LEVEL_SCOPES) {
    const extras = resolved[scope];
    if (!extras?.length) continue;

    const key = catalogKeyForScope(scope);
    if (!key) continue;

    const existing = (merged[key] as TargetOption[] | undefined) ?? [];
    const byId = new Map(existing.map((o) => [o.id, o]));
    for (const option of extras) {
      byId.set(option.id, option);
    }
    merged[key] = Array.from(byId.values()) as PromotionTargetCatalog[typeof key];
  }

  return merged;
}

function missingSelectedIds(
  form: PromotionWizardForm,
  catalog: PromotionTargetCatalog | undefined,
  scope: TargetScopeId
): string[] {
  const ids = form.selectedTargets[scope];
  if (!ids?.length) return [];

  const options = catalogForScope(scope, catalog ?? {}) ?? [];
  const known = new Set(options.map((o) => o.id));
  return ids.filter((id) => !known.has(id));
}

/** Load selected inventory rows missing from the lightweight base catalog (smart-target flows). */
export async function resolveLazySelectedOptions(
  form: PromotionWizardForm,
  catalog: PromotionTargetCatalog | undefined,
  adapter?: SmartTargetCatalogAdapter
): Promise<Partial<Record<TargetScopeId, TargetOption[]>>> {
  if (!adapter) return {};

  const resolved: Partial<Record<TargetScopeId, TargetOption[]>> = {};
  const vendorId = form.selectedTargets.vendors?.[0];

  const missingProducts = missingSelectedIds(form, catalog, 'products');
  if (missingProducts.length > 0 && vendorId && adapter.loadSellerProducts) {
    const rows = await adapter.loadSellerProducts(vendorId, '');
    resolved.products = rows.filter((row) => missingProducts.includes(row.id));
  }

  const inventoryTypes: VendorInventoryType[] = ['services', 'packages', 'meal_plans'];
  if (vendorId && adapter.loadVendorInventory) {
    await Promise.all(
      inventoryTypes.map(async (inventoryType) => {
        const scope = inventoryType as TargetScopeId;
        const missing = missingSelectedIds(form, catalog, scope);
        if (missing.length === 0) return;
        const rows = await adapter.loadVendorInventory!(vendorId, inventoryType, '');
        resolved[scope] = rows.filter((row) => missing.includes(row.id));
      })
    );
  }

  const missingServices = missingSelectedIds(form, catalog, 'services');
  const categoryIds = form.selectedTargets.categories ?? [];
  if (missingServices.length > 0 && categoryIds.length > 0 && adapter.loadCatalogServicesByCategory) {
    const rows = await adapter.loadCatalogServicesByCategory(categoryIds, '');
    resolved.services = rows.filter((row) => missingServices.includes(row.id));
  }

  return resolved;
}

export function collectSelectedTargetOptions(
  form: PromotionWizardForm,
  catalog?: PromotionTargetCatalog
): SelectedTargetPreview[] {
  if (!catalog) return [];

  const results: SelectedTargetPreview[] = [];
  const seen = new Set<string>();

  for (const scope of ITEM_LEVEL_SCOPES) {
    const ids = form.selectedTargets[scope];
    if (!ids?.length) continue;

    const options = catalogForScope(scope, catalog) ?? [];
    const optionMap = new Map(options.map((o) => [o.id, o]));

    for (const id of ids) {
      const key = `${scope}:${id}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const option = optionMap.get(id);
      results.push({
        id,
        label: option?.label?.trim() || 'Unnamed item',
        scope,
        price: option ? resolveTargetPrice(option) : undefined,
      });
    }
  }

  return results;
}

export function selectedPreviewSectionTitle(items: SelectedTargetPreview[]): string {
  const scopes = new Set(items.map((i) => i.scope));
  if (scopes.size === 1) {
    const scope = items[0].scope;
    const label = SCOPE_LABELS[scope];
    return `Selected ${label} — customer price preview`;
  }
  return 'Selected items — customer price preview';
}

export function selectedPreviewFooter(
  items: SelectedTargetPreview[],
  form: Pick<PromotionWizardForm, 'discountType' | 'discountValue'>
): string {
  const count = items.length;
  const scopeCounts = ITEM_LEVEL_SCOPES.reduce<Record<string, number>>((acc, scope) => {
    const n = items.filter((i) => i.scope === scope).length;
    if (n > 0) acc[SCOPE_LABELS[scope]] = n;
    return acc;
  }, {});

  const countLabel =
    Object.keys(scopeCounts).length === 1
      ? `${count} ${Object.keys(scopeCounts)[0]}`
      : `${count} items`;

  const discountLabel =
    form.discountType === 'percentage'
      ? `${form.discountValue}% off`
      : `₹${form.discountValue} off`;

  return `${countLabel} · ${discountLabel} applied to listed prices`;
}
