import { filterServicesForVetHub } from '@/lib/filter-hub-services';

export type VetHubServiceRow = {
  id: string;
  serviceId: string;
  name: string;
  price: number;
  originalPrice?: number;
  vendorDiscount?: number;
  duration: number;
  description?: string;
  category?: string;
  isPackage?: boolean;
};

/** Map GET /customer/vendor/:id/services rows (card or legacy) for vet hub UI. */
export function mapVendorServicesForVetHub(rows: unknown[]): VetHubServiceRow[] {
  const mapped = (rows || []).map((raw) => {
    const s = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    return {
      id: String(s.id ?? s.serviceId ?? s.service_id ?? ''),
      serviceId: String(s.serviceId ?? s.id ?? s.service_id ?? ''),
      name: String(s.name ?? s.serviceName ?? 'Service'),
      price: Number(s.price ?? 0),
      originalPrice: s.originalPrice != null ? Number(s.originalPrice) : undefined,
      vendorDiscount: s.vendorDiscount != null ? Number(s.vendorDiscount) : undefined,
      duration: Number(s.duration ?? 30),
      description: String(s.shortDescription ?? s.description ?? '').trim() || undefined,
      category: String(s.categoryLabel ?? s.category ?? s.categoryName ?? '').trim() || undefined,
      isPackage: Boolean(s.isPackage ?? s.is_package),
      categoryName: s.categoryName as string | undefined,
      categorySlug: s.categorySlug as string | undefined,
      catalogServiceId: s.catalogServiceId as string | undefined,
      catalogServiceSlug: s.catalogServiceSlug as string | undefined,
    };
  });
  return filterServicesForVetHub(mapped);
}
