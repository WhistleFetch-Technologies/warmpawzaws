/**
 * Session-level in-flight dedupe + short memo for discovery list GETs.
 * Zero AWS cost; speeds second-tap / remount within a session.
 */
import { apiClient } from '@/lib/api-client';

const TTL_MS = 60_000;

type CacheEntry = { expires: number; data: unknown };

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();

function normalizeDiscoveryPath(path: string): string {
  // Collapse whitespace; keep query order as callers build it.
  return path.trim();
}

/** True for discover-services / by-style list endpoints. */
export function isDiscoveryListPath(path: string): boolean {
  return (
    path.includes('/customer/discover-services') ||
    path.includes('/customer/services/by-style')
  );
}

/**
 * GET with in-flight reuse and ~60s session memo for discovery lists.
 * Other paths pass through to apiClient unchanged.
 */
export async function fetchDiscoveryList<T = unknown>(path: string): Promise<T> {
  if (!isDiscoveryListPath(path)) {
    return apiClient.get(path) as Promise<T>;
  }

  const key = normalizeDiscoveryPath(path);
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) {
    return hit.data as T;
  }

  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;

  const request = (async () => {
    try {
      const data = await apiClient.get(path);
      cache.set(key, { expires: Date.now() + TTL_MS, data });
      return data;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, request);
  return request as Promise<T>;
}

/** Test/helper: clear session memo. */
export function clearDiscoveryListCache(): void {
  cache.clear();
  inflight.clear();
}
