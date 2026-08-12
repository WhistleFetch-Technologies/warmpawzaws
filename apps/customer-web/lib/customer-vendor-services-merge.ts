/**
 * GET /customer/vendor/:vendorId/services returns `services` and `packages`.
 * Package rows may appear in `services` (combined list) and/or only in `packages` (legacy).
 * Merge and dedupe by vendor_services.id so booking UIs see custom vendor packages everywhere.
 */

export function mergeCustomerVendorServicesPayload(
  res: { services?: unknown[]; packages?: unknown[] } | null | undefined
): any[] {
  if (!res || typeof res !== 'object') return [];
  const a = Array.isArray(res.services) ? res.services : [];
  const b = Array.isArray(res.packages) ? res.packages : [];
  const seen = new Set<string>();
  const out: any[] = [];
  for (const row of [...a, ...b]) {
    if (!row || typeof row !== 'object') continue;
    const id = (row as { id?: unknown }).id;
    const key = id != null && String(id).trim() !== '' ? `id:${String(id)}` : '';
    if (key) {
      if (seen.has(key)) continue;
      seen.add(key);
    }
    out.push(row);
  }
  return out;
}

/** Normalized service row for HomeServiceProviderProfile selection UI. */
export type HomeServiceProfileService = {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: number;
  category: string;
  isPackage?: boolean;
  packageDetails?: unknown;
  metadata?: unknown;
  serviceId?: string;
};

/**
 * Map raw vendor/customer service API rows to stable selection keys (deduped).
 * Aligns with boarding/clinic profile mappers — always string ids for React keys and state.
 */
export function mapHomeServiceProfileServices(rows: unknown[]): HomeServiceProfileService[] {
  const seen = new Set<string>();
  const mapped: HomeServiceProfileService[] = [];

  for (let idx = 0; idx < (rows?.length ?? 0); idx++) {
    const raw = rows[idx];
    if (!raw || typeof raw !== 'object') continue;
    const s = raw as Record<string, unknown>;

    const id = String(s.id ?? s.vendorServiceId ?? s.serviceId ?? s.service_id ?? '').trim();
    const key = id || `row-${idx}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const name = String(s.name ?? s.serviceName ?? s.service_name ?? 'Service').trim() || 'Service';
    const description = String(
      s.description ?? s.shortDescription ?? s.longDescription ?? ''
    ).trim();
    const price =
      parseFloat(String(s.price ?? s.custom_price ?? s.base_price ?? 0)) || 0;
    const duration =
      Number(s.duration ?? s.durationMinutes ?? s.duration_minutes ?? 0) || 0;
    const category = String(s.category ?? s.categoryName ?? s.categorySlug ?? '').trim();
    const meta =
      s.metadata && typeof s.metadata === 'object' && !Array.isArray(s.metadata)
        ? (s.metadata as Record<string, unknown>)
        : undefined;
    const packageDetails = s.packageDetails ?? meta?.packageDetails;
    const isPackage = Boolean(
      s.isPackage ?? s.is_package ?? meta?.isPackage ?? packageDetails
    );

    mapped.push({
      id: key,
      name,
      description,
      price,
      duration,
      category,
      isPackage,
      packageDetails,
      metadata: meta ?? s.metadata,
      serviceId: String(s.serviceId ?? s.service_id ?? '').trim() || undefined,
    });
  }

  return mapped;
}
