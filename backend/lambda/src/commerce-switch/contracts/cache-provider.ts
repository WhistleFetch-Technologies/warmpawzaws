export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  version?: number;
}

export interface CacheProvider {
  get<T>(key: string): CacheEntry<T> | null;
  set<T>(key: string, value: T, ttlMs: number, version?: number): void;
  invalidate(key: string): void;
  invalidatePrefix(prefix: string): void;
}
