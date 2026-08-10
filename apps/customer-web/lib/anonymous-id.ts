/**
 * Durable anonymous visitor id for Allyticas guest journeys.
 * Survives login so Phase 4 can emit identity_authenticated and stitch sessions.
 */

const STORAGE_KEY = 'warmpawz_anonymous_id';

function createAnonymousId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `anon_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

/** Returns existing anonymous_id or creates and persists one. */
export function getOrCreateAnonymousId(): string {
  if (typeof window === 'undefined') return 'anon_ssr';
  try {
    const existing = localStorage.getItem(STORAGE_KEY)?.trim();
    if (existing) return existing;
    const id = createAnonymousId();
    localStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    return createAnonymousId();
  }
}

export function getAnonymousIdStorageKey(): string {
  return STORAGE_KEY;
}
