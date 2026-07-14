/**
 * GET /customer/vendor/:vendorId/services returns `services` and `packages`.
 * Package rows may appear in `services` (combined list) and/or only in `packages` (legacy).
 * Merge and dedupe by vendor_services.id so booking UIs see custom vendor packages everywhere.
 */

/** Expandable list card preview */
export const VENDOR_SERVICES_PREVIEW_LIMIT = 5;
/** Profile Services tab page size (infinite scroll) */
export const VENDOR_SERVICES_PROFILE_PAGE_SIZE = 10;

export type VendorServicesPageMeta = {
  total: number;
  offset: number;
  limit: number | null;
  hasMore: boolean;
};

export function parseVendorServicesPageMeta(
  res: Record<string, unknown> | null | undefined
): VendorServicesPageMeta {
  if (!res || typeof res !== 'object') {
    return { total: 0, offset: 0, limit: null, hasMore: false };
  }
  const mergedLen = mergeCustomerVendorServicesPayload(res as any).length;
  const total = Number(res.total);
  const offset = Number(res.offset);
  const limitRaw = res.limit;
  const limit =
    limitRaw != null && String(limitRaw).trim() !== ''
      ? Number(limitRaw)
      : null;
  const hasMore =
    typeof res.hasMore === 'boolean'
      ? res.hasMore
      : Number.isFinite(total) && Number.isFinite(offset) && limit != null
        ? offset + mergedLen < total
        : false;
  return {
    total: Number.isFinite(total) ? total : mergedLen,
    offset: Number.isFinite(offset) ? offset : 0,
    limit: limit != null && Number.isFinite(limit) ? limit : null,
    hasMore,
  };
}

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

    mapped.push({ id: key, name, description, price, duration, category });
  }

  return mapped;
}
