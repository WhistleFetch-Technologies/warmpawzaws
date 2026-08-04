import type { CacheEntry, CacheProvider } from '../contracts/cache-provider';

export class InMemoryCacheProvider implements CacheProvider {
  private readonly store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): CacheEntry<T> | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry as CacheEntry<T>;
  }

  set<T>(key: string, value: T, ttlMs: number, version?: number): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
      version,
    });
  }

  invalidate(key: string): void {
    this.store.delete(key);
  }

  invalidatePrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }
}

let defaultCacheProvider: InMemoryCacheProvider | null = null;

export function getDefaultCacheProvider(): InMemoryCacheProvider {
  if (!defaultCacheProvider) {
    defaultCacheProvider = new InMemoryCacheProvider();
  }
  return defaultCacheProvider;
}

export function resetDefaultCacheProviderForTests(provider?: InMemoryCacheProvider): void {
  defaultCacheProvider = provider ?? null;
}

export function invalidateCommerceSwitchCache(): void {
  getDefaultCacheProvider().invalidatePrefix('commerce-switch:');
}
