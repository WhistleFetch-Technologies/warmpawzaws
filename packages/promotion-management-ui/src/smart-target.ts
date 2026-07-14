import type {
  PromotionWizardForm,
  SmartTargetFlowId,
  SmartTargetSurface,
  TargetOption,
  TargetScopeId,
  VendorInventoryType,
} from './types';

export const SMART_FLOW_LABELS: Record<
  SmartTargetFlowId,
  { marketing: string; ecommerce: string }
> = {
  entire_platform: {
    marketing: 'Entire platform',
    ecommerce: 'Entire marketplace',
  },
  all_products: {
    marketing: 'All Products',
    ecommerce: 'All Products',
  },
  categories: {
    marketing: 'Categories',
    ecommerce: 'Product Categories',
  },
  vendor_inventory: {
    marketing: 'Vendor inventory',
    ecommerce: 'Seller inventory',
  },
};

export const INVENTORY_TYPE_LABELS: Record<VendorInventoryType, string> = {
  services: 'Services',
  packages: 'Packages',
  meal_plans: 'Meal plans',
};

export function inventoryTypeToScope(type: VendorInventoryType): TargetScopeId {
  return type;
}

export function isEligiblePublishedInventory(row: Record<string, unknown>): boolean {
  const activeRaw = row.isActive ?? row.is_active ?? row.isEnabled ?? row.is_enabled ?? row.isAvailable ?? row.is_available;
  if (activeRaw != null && activeRaw !== '') {
    if (typeof activeRaw === 'boolean' && !activeRaw) return false;
    const activeNorm = String(activeRaw).trim().toLowerCase();
    if (['false', '0', 'inactive', 'disabled', 'deleted'].includes(activeNorm)) return false;
  }

  const statusRaw =
    row.status ??
    row.approvalStatus ??
    row.approval_status ??
    row.publishStatus ??
    row.publish_status;
  if (statusRaw == null || statusRaw === '') return true;

  const status = String(statusRaw).trim().toLowerCase();
  const blocked = [
    'draft',
    'archived',
    'disabled',
    'deleted',
    'pending',
    'pending_approval',
    'rejected',
    'inactive',
  ];
  if (blocked.some((b) => status.includes(b))) return false;
  return ['approved', 'active', 'published', 'live', 'auto_published'].includes(status);
}

export function filterOptionsByQuery(options: TargetOption[], query: string): TargetOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return options;
  return options.filter(
    (o) =>
      o.label.toLowerCase().includes(q) ||
      o.subtitle?.toLowerCase().includes(q) ||
      o.id.toLowerCase().includes(q)
  );
}

export function inferSmartFlowFromForm(
  form: Pick<PromotionWizardForm, 'targetScopes' | 'selectedTargets'>,
  surface: SmartTargetSurface
): SmartTargetFlowId {
  if (surface === 'ecommerce') {
    if (
      form.targetScopes.includes('all_products') ||
      form.targetScopes.includes('entire_platform')
    ) {
      return 'all_products';
    }

    const hasVendor = (form.selectedTargets.vendors?.length ?? 0) > 0;
    const hasProducts = (form.selectedTargets.products?.length ?? 0) > 0;

    if (hasVendor || hasProducts || form.targetScopes.includes('products')) {
      return 'vendor_inventory';
    }
    if (form.targetScopes.includes('categories') || (form.selectedTargets.categories?.length ?? 0) > 0) {
      return 'categories';
    }
    return 'all_products';
  }

  if (form.targetScopes.includes('entire_platform')) return 'entire_platform';

  const hasVendor = (form.selectedTargets.vendors?.length ?? 0) > 0;
  const hasServiceInventory =
    (form.selectedTargets.services?.length ?? 0) > 0 ||
    (form.selectedTargets.packages?.length ?? 0) > 0 ||
    (form.selectedTargets.meal_plans?.length ?? 0) > 0;

  if (hasVendor || hasServiceInventory || form.targetScopes.some((s) => ['services', 'packages', 'meal_plans'].includes(s))) {
    return 'vendor_inventory';
  }
  if (form.targetScopes.includes('categories') || (form.selectedTargets.categories?.length ?? 0) > 0) {
    return 'categories';
  }
  if (form.targetScopes.includes('styles') && !(form.selectedTargets.categories?.length ?? 0)) {
    return 'categories';
  }
  return 'entire_platform';
}

export function inferInventoryTypeFromForm(
  form: Pick<PromotionWizardForm, 'targetScopes' | 'selectedTargets'>
): VendorInventoryType {
  if ((form.selectedTargets.meal_plans?.length ?? 0) > 0 || form.targetScopes.includes('meal_plans')) {
    return 'meal_plans';
  }
  if ((form.selectedTargets.packages?.length ?? 0) > 0 || form.targetScopes.includes('packages')) {
    return 'packages';
  }
  return 'services';
}

export function buildSmartTargetScopes(
  flow: SmartTargetFlowId,
  inventoryType: VendorInventoryType,
  includeOptionalStyles: boolean,
  options?: { includeCatalogServices?: boolean; ecommerceProducts?: boolean }
): TargetScopeId[] {
  if (flow === 'entire_platform') return ['entire_platform'];
  if (flow === 'all_products') return ['all_products'];
  if (flow === 'categories') {
    const scopes: TargetScopeId[] = ['categories'];
    if (options?.includeCatalogServices) scopes.push('services');
    if (includeOptionalStyles) scopes.push('styles');
    return scopes;
  }
  if (flow === 'vendor_inventory') {
    return options?.ecommerceProducts
      ? ['vendors', 'products']
      : ['vendors', inventoryTypeToScope(inventoryType)];
  }
  return ['entire_platform'];
}

export function countSmartSelections(
  selectedTargets: Partial<Record<TargetScopeId, string[]>>,
  flow: SmartTargetFlowId
): number {
  if (flow === 'entire_platform' || flow === 'all_products') return 0;
  return Object.values(selectedTargets).reduce((sum, ids) => sum + (ids?.length ?? 0), 0);
}

export function formatSmartTargetSummary(
  form: PromotionWizardForm,
  surface: SmartTargetSurface,
  catalog?: { categories?: TargetOption[]; vendors?: TargetOption[] }
): string {
  const flow = inferSmartFlowFromForm(form, surface);
  const flowLabel = SMART_FLOW_LABELS[flow][surface === 'ecommerce' ? 'ecommerce' : 'marketing'];

  if (flow === 'entire_platform' || flow === 'all_products') return flowLabel;

  if (flow === 'categories') {
    const cats = form.selectedTargets.categories ?? [];
    const names = cats
      .map((id) => catalog?.categories?.find((c) => c.id === id)?.label ?? id)
      .slice(0, 3);
    const serviceCount = form.selectedTargets.services?.length ?? 0;
    const styleCount = form.selectedTargets.styles?.length ?? 0;
    let base = cats.length
      ? `${cats.length} categor${cats.length === 1 ? 'y' : 'ies'}${names.length ? `: ${names.join(', ')}` : ''}`
      : 'Categories';
    if (serviceCount > 0) {
      base += ` · ${serviceCount} catalogue service${serviceCount === 1 ? '' : 's'}`;
    }
    return styleCount ? `${base} · ${styleCount} style${styleCount === 1 ? '' : 's'}` : base;
  }

  const vendorId = form.selectedTargets.vendors?.[0];
  const vendorLabel = catalog?.vendors?.find((v) => v.id === vendorId)?.label ?? 'Selected vendor';
  const ownershipBit =
    form.listingOwnershipScope === 'own_brand'
      ? ' · owned'
      : form.listingOwnershipScope === 'third_party'
        ? ' · third party'
        : '';
  if (surface === 'ecommerce') {
    const n = form.selectedTargets.products?.length ?? 0;
    return n
      ? `${vendorLabel} · ${n} product${n === 1 ? '' : 's'}${ownershipBit}`
      : `${vendorLabel} · products${ownershipBit}`;
  }

  const type = inferInventoryTypeFromForm(form);
  const n = form.selectedTargets[type]?.length ?? 0;
  return n
    ? `${vendorLabel} · ${INVENTORY_TYPE_LABELS[type]} (${n})`
    : `${vendorLabel} · ${INVENTORY_TYPE_LABELS[type]}`;
}
