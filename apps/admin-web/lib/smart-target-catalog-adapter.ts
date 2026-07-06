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
  return {
    id,
    label: String(p.name ?? p.title ?? id),
    subtitle: p.price != null ? `₹${p.price}` : p.sku ? String(p.sku) : undefined,
    group: p.category ? String(p.category) : undefined,
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
