import type {
  SmartTargetCatalogAdapter,
  TargetOption,
  VendorInventoryType,
} from '@warmpawz/promotion-management-ui';
import { filterOptionsByQuery, isEligiblePublishedInventory } from '@warmpawz/promotion-management-ui';
import type { AdminPromoSurface } from '@/lib/promotion-domain/surface-config';

type ApiClientLike = {
  get<T>(path: string): Promise<T>;
};

function mapVendorOption(v: Record<string, unknown>): TargetOption | null {
  const id = String(v.id ?? v.vendor_id ?? '').trim();
  if (!id) return null;
  const label = String(
    v.business_name ??
      v.businessName ??
      v.full_name ??
      v.fullName ??
      v.owner_name ??
      v.name ??
      id
  ).trim();
  return {
    id,
    label: label || id,
    subtitle: v.city ? String(v.city) : v.roleDisplayName ? String(v.roleDisplayName) : undefined,
  };
}

function mapServiceRow(s: Record<string, unknown>): TargetOption | null {
  const id = String(s.id ?? '').trim();
  if (!id || id === 'undefined') return null;
  const label = String(s.serviceName ?? s.service_name ?? s.name ?? 'Unnamed service').trim();
  const price = s.customPrice ?? s.custom_price ?? s.price;
  return {
    id,
    label,
    subtitle: price != null && price !== '' ? `₹${price}` : undefined,
  };
}

function mapPackageRow(p: Record<string, unknown>): TargetOption | null {
  const id = String(p.id ?? '').trim();
  if (!id || id === 'undefined') return null;
  const label = String(p.packageName ?? p.package_name ?? p.name ?? 'Unnamed package').trim();
  const price = p.packagePrice ?? p.package_price ?? p.price;
  return {
    id,
    label,
    subtitle: price != null && price !== '' ? `₹${price}` : undefined,
  };
}

function mapMealRow(p: Record<string, unknown>): TargetOption | null {
  const id = String(p.id ?? '').trim();
  if (!id || id === 'undefined') return null;
  return {
    id,
    label: String(p.name ?? p.plan_name ?? p.planName ?? 'Meal plan'),
    subtitle:
      p.price != null || p.price_per_meal != null ? `₹${p.price_per_meal ?? p.price}` : undefined,
  };
}

function mapProductRow(p: Record<string, unknown>): TargetOption | null {
  const id = String(p.id ?? '').trim();
  if (!id) return null;
  const priceRaw = p.price ?? p.selling_price ?? p.sellingPrice;
  const price =
    priceRaw != null && priceRaw !== '' && Number.isFinite(Number(priceRaw))
      ? Number(priceRaw)
      : undefined;
  const ownershipRaw = p.listing_ownership ?? p.listingOwnership;
  const listingOwnership =
    ownershipRaw === 'own_brand' || ownershipRaw === 'third_party' ? ownershipRaw : null;
  const ownershipLabel =
    listingOwnership === 'own_brand'
      ? 'Owned'
      : listingOwnership === 'third_party'
        ? 'Third party'
        : null;
  const priceLabel = price != null ? `₹${price}` : p.sku ? String(p.sku) : undefined;
  return {
    id,
    label: String(p.name ?? p.title ?? id),
    subtitle: [priceLabel, ownershipLabel].filter(Boolean).join(' · ') || undefined,
    price,
    group: p.category ? String(p.category) : undefined,
    listingOwnership,
  };
}

/** Reuses existing vendor/admin APIs — no new backend endpoints. */
export function createAdminSmartTargetAdapter(
  apiClient: ApiClientLike,
  surface: AdminPromoSurface,
  partnerCache: TargetOption[]
): SmartTargetCatalogAdapter {
  return {
    async searchPartners(query: string): Promise<TargetOption[]> {
      const q = query.trim().toLowerCase();
      if (partnerCache.length > 0) {
        return filterOptionsByQuery(partnerCache, q);
      }
      const res = await apiClient.get<{ vendors?: unknown[]; data?: unknown[] }>(
        '/admin/vendors?limit=200'
      );
      const raw = res.vendors ?? res.data ?? [];
      const rows = (Array.isArray(raw) ? raw : [])
        .map((v) => mapVendorOption(v as Record<string, unknown>))
        .filter(Boolean) as TargetOption[];
      return filterOptionsByQuery(rows, q);
    },

    async loadCatalogServicesByCategory(
      categoryIds: string[],
      search: string
    ): Promise<TargetOption[]> {
      if (surface !== 'marketing') return [];
      const ids = categoryIds.map((c) => String(c).trim()).filter(Boolean);
      if (ids.length === 0) return [];

      const allRows: TargetOption[] = [];
      const seen = new Set<string>();

      await Promise.all(
        ids.map(async (categoryId) => {
          const res = await apiClient
            .get<{
              services?: Record<string, unknown>[];
              data?: Record<string, unknown>[];
            }>(`/admin/service-catalog?categoryId=${encodeURIComponent(categoryId)}&groupBy=none`)
            .catch(() => ({ services: [], data: [] }));
          const raw = res.services ?? res.data ?? [];
          for (const row of Array.isArray(raw) ? raw : []) {
            const option = mapCatalogServiceRow(row);
            if (!option || seen.has(option.id)) continue;
            seen.add(option.id);
            allRows.push(option);
          }
        })
      );

      return filterOptionsByQuery(allRows, search);
    },

    async loadVendorInventory(
      vendorId: string,
      inventoryType: VendorInventoryType,
      search: string
    ): Promise<TargetOption[]> {
      if (surface !== 'marketing') return [];

      if (inventoryType === 'services') {
        const res = await apiClient
          .get<{ services?: Record<string, unknown>[] }>(`/vendor/${vendorId}/services/enabled`)
          .catch(() => ({ services: [] }));
        const rows = (res.services ?? [])
          .filter((s) => !s.isPackage && !s.is_package)
          .filter(isEligiblePublishedInventory)
          .map(mapServiceRow)
          .filter(Boolean) as TargetOption[];
        return filterOptionsByQuery(rows, search);
      }

      if (inventoryType === 'packages') {
        const [servicesRes, packagesRes] = await Promise.all([
          apiClient
            .get<{ services?: Record<string, unknown>[] }>(`/vendor/${vendorId}/services/enabled`)
            .catch(() => ({ services: [] })),
          apiClient
            .get<{ packages?: Record<string, unknown>[] }>(`/vendor/${vendorId}/packages`)
            .catch(() => ({ packages: [] })),
        ]);
        const fromServices = (servicesRes.services ?? [])
          .filter((s) => s.isPackage || s.is_package)
          .filter(isEligiblePublishedInventory)
          .map(mapServiceRow)
          .filter(Boolean) as TargetOption[];
        const fromPackages = (packagesRes.packages ?? [])
          .filter(isEligiblePublishedInventory)
          .map(mapPackageRow)
          .filter(Boolean) as TargetOption[];
        const merged = [...fromServices, ...fromPackages];
        const seen = new Set<string>();
        const unique = merged.filter((p) => {
          if (seen.has(p.id)) return false;
          seen.add(p.id);
          return true;
        });
        return filterOptionsByQuery(unique, search);
      }

      const res = await apiClient
        .get<{ mealPlans?: Record<string, unknown>[]; plans?: Record<string, unknown>[] }>(
          `/vendor/${vendorId}/nutritionist/meal-plans`
        )
        .catch(() => ({ mealPlans: [], plans: [] }));
      const rows = (res.mealPlans ?? res.plans ?? [])
        .filter(isEligiblePublishedInventory)
        .map(mapMealRow)
        .filter(Boolean) as TargetOption[];
      return filterOptionsByQuery(rows, search);
    },

    async loadSellerProducts(sellerId: string, search: string): Promise<TargetOption[]> {
      if (surface !== 'ecommerce') return [];
      const res = await apiClient
        .get<{ products?: Record<string, unknown>[] }>(`/vendor/${sellerId}/products`)
        .catch(() => ({ products: [] }));
      const rows = (res.products ?? [])
        .filter(isEligiblePublishedInventory)
        .map(mapProductRow)
        .filter(Boolean) as TargetOption[];
      return filterOptionsByQuery(rows, search);
    },
  };
}

/** Prefer UUID `id` (vendor_services.service_id FK) plus text service_id as subtitle. */
function mapCatalogServiceRow(s: Record<string, unknown>): TargetOption | null {
  const uuid = String(s.id ?? '').trim();
  const textId = String(s.service_id ?? s.serviceId ?? '').trim();
  // Persist UUID when present so booking can expand via vendor_services.service_id
  const id = UUID_RE.test(uuid) ? uuid : textId || uuid;
  if (!id || id === 'undefined') return null;
  const label = String(
    s.display_name ?? s.displayName ?? s.service_name ?? s.serviceName ?? s.name ?? id
  ).trim();
  const categoryName = s.category_name ?? s.categoryName;
  const style = s.service_style ?? s.serviceStyle;
  const subtitleParts = [
    categoryName ? String(categoryName) : '',
    style ? String(style).replace(/_/g, ' ') : '',
    textId && textId !== id ? textId : '',
  ].filter(Boolean);
  return {
    id,
    label: label || id,
    subtitle: subtitleParts.length ? subtitleParts.join(' · ') : undefined,
    group: categoryName ? String(categoryName) : undefined,
  };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
