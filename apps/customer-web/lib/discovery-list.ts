/**
 * Client helpers for discovery list feeds (vendors-only envelope + cursor).
 */

export function discoveryVendorList(data: unknown): Record<string, unknown>[] {
  if (!data || typeof data !== 'object') return [];
  const d = data as Record<string, unknown>;
  if (Array.isArray(d.vendors)) return d.vendors as Record<string, unknown>[];
  /** @deprecated legacy twin — remove after all clients migrated */
  if (Array.isArray(d.providers)) return d.providers as Record<string, unknown>[];
  return [];
}

export function discoveryNextCursor(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const c = (data as Record<string, unknown>).nextCursor;
  return c != null && String(c).trim() ? String(c) : null;
}

export function discoveryServiceList(data: unknown): Record<string, unknown>[] {
  if (!data || typeof data !== 'object') return [];
  const s = (data as Record<string, unknown>).services;
  return Array.isArray(s) ? (s as Record<string, unknown>[]) : [];
}
