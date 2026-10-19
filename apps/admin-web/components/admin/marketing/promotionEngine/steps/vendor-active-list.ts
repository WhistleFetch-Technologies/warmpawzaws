/** Active vendor rows from GET /admin/vendors/active (approved or active, and is_active). */
export type ActiveVendorHit = {
  id: string;
  business_name?: string;
  businessName?: string;
  ownerName?: string;
  role_display_name?: string;
  roleDisplayName?: string;
};

export const ACTIVE_VENDOR_PAGE_SIZE = 500;

export function activeVendorLabel(v: ActiveVendorHit): string {
  return v.business_name || v.businessName || v.ownerName || v.id;
}

export function activeVendorRole(v: ActiveVendorHit): string {
  return v.role_display_name || v.roleDisplayName || '';
}

export function filterActiveVendors(vendors: ActiveVendorHit[], query: string): ActiveVendorHit[] {
  const q = query.trim().toLowerCase();
  const sorted = [...vendors].sort((a, b) =>
    activeVendorLabel(a).localeCompare(activeVendorLabel(b), 'en', { sensitivity: 'base' }),
  );
  if (!q) return sorted;
  return sorted.filter((v) => {
    const hay = `${activeVendorLabel(v)} ${activeVendorRole(v)}`.toLowerCase();
    return hay.includes(q);
  });
}

type VendorPage = { vendors?: ActiveVendorHit[]; total?: number };

/**
 * Loads every page of /admin/vendors/active. Search is applied in the picker
 * so a short name still finds a vendor outside the first page.
 */
export async function fetchAllActiveVendors(
  get: (url: string) => Promise<VendorPage>,
): Promise<ActiveVendorHit[]> {
  const all: ActiveVendorHit[] = [];
  const seen = new Set<string>();
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;

  while (offset < total && offset < 20000) {
    const page = await get(
      `/admin/vendors/active?limit=${ACTIVE_VENDOR_PAGE_SIZE}&offset=${offset}`,
    );
    const batch = Array.isArray(page.vendors) ? page.vendors : [];
    const reported = Number(page.total);
    if (Number.isFinite(reported) && reported >= 0) total = reported;
    for (const v of batch) {
      if (!v?.id || seen.has(v.id)) continue;
      seen.add(v.id);
      all.push(v);
    }
    if (batch.length === 0) break;
    offset += batch.length;
    if (batch.length < ACTIVE_VENDOR_PAGE_SIZE) break;
  }

  return all;
}
