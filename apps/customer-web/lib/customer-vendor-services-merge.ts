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
