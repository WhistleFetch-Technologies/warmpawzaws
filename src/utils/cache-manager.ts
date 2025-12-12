/**
 * Cache Manager Utility
 * LocalStorage-based caching with TTL support
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

export class CacheManager {
  private prefix = 'warmpawz_cache_';

  /**
   * Save data to cache with TTL
   */
  save<T>(key: string, data: T, ttl: number = 5 * 60 * 1000): void {
    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl
      };

      localStorage.setItem(
        `${this.prefix}${key}`,
        JSON.stringify(entry)
      );

      if (process.env.NODE_ENV === 'development') {
        console.log(`💾 [CACHE] Saved: ${key} (TTL: ${ttl / 1000}s)`);
      }
    } catch (error) {
      console.warn('Cache save failed:', error);
      // Silently fail - cache is not critical
    }
  }

  /**
   * Get data from cache if not expired
   */
  get<T>(key: string): T | null {
    try {
      const cached = localStorage.getItem(`${this.prefix}${key}`);
      if (!cached) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`💾 [CACHE] Miss: ${key}`);
        }
        return null;
      }

      const entry: CacheEntry<T> = JSON.parse(cached);
      const age = Date.now() - entry.timestamp;

      // Check if expired
      if (age > entry.ttl) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`💾 [CACHE] Expired: ${key} (age: ${(age / 1000).toFixed(1)}s)`);
        }
        this.remove(key);
        return null;
      }

      if (process.env.NODE_ENV === 'development') {
        console.log(`💾 [CACHE] Hit: ${key} (age: ${(age / 1000).toFixed(1)}s)`);
      }

      return entry.data;
    } catch (error) {
      console.warn('Cache get failed:', error);
      return null;
    }
  }

  /**
   * Remove specific cache entry
   */
  remove(key: string): void {
    try {
      localStorage.removeItem(`${this.prefix}${key}`);
      if (process.env.NODE_ENV === 'development') {
        console.log(`💾 [CACHE] Removed: ${key}`);
      }
    } catch (error) {
      console.warn('Cache remove failed:', error);
    }
  }

  /**
   * Clear all cache entries
   */
  clearAll(): void {
    try {
      const keys = Object.keys(localStorage);
      const cacheKeys = keys.filter(k => k.startsWith(this.prefix));
      
      cacheKeys.forEach(key => {
        localStorage.removeItem(key);
      });

      if (process.env.NODE_ENV === 'development') {
        console.log(`💾 [CACHE] Cleared all (${cacheKeys.length} entries)`);
      }
    } catch (error) {
      console.warn('Cache clear failed:', error);
    }
  }

  /**
   * Clear cache entries by pattern
   */
  clearPattern(pattern: string): void {
    try {
      const keys = Object.keys(localStorage);
      const matchingKeys = keys.filter(k => 
        k.startsWith(this.prefix) && k.includes(pattern)
      );

      matchingKeys.forEach(key => {
        localStorage.removeItem(key);
      });

      if (process.env.NODE_ENV === 'development') {
        console.log(`💾 [CACHE] Cleared pattern: ${pattern} (${matchingKeys.length} entries)`);
      }
    } catch (error) {
      console.warn('Cache clear pattern failed:', error);
    }
  }

  /**
   * Get cache stats
   */
  getStats(): {
    total: number;
    totalSize: number;
    entries: Array<{ key: string; size: number; age: number; ttl: number }>;
  } {
    const keys = Object.keys(localStorage);
    const cacheKeys = keys.filter(k => k.startsWith(this.prefix));
    
    let totalSize = 0;
    const entries = cacheKeys.map(key => {
      const value = localStorage.getItem(key) || '';
      const size = new Blob([value]).size;
      totalSize += size;

      let age = 0;
      let ttl = 0;
      try {
        const entry = JSON.parse(value);
        age = Date.now() - entry.timestamp;
        ttl = entry.ttl;
      } catch (error) {
        // Invalid entry
      }

      return {
        key: key.replace(this.prefix, ''),
        size,
        age,
        ttl
      };
    });

    return {
      total: cacheKeys.length,
      totalSize,
      entries
    };
  }

  /**
   * Log cache stats to console
   */
  logStats(): void {
    const stats = this.getStats();
    console.group('💾 Cache Statistics');
    console.log('Total entries:', stats.total);
    console.log('Total size:', (stats.totalSize / 1024).toFixed(2), 'KB');
    console.table(stats.entries.map(e => ({
      key: e.key,
      size: `${(e.size / 1024).toFixed(2)} KB`,
      age: `${(e.age / 1000).toFixed(1)}s`,
      ttl: `${(e.ttl / 1000).toFixed(1)}s`,
      expired: e.age > e.ttl ? '❌' : '✅'
    })));
    console.groupEnd();
  }

  /**
   * Clean up expired entries
   */
  cleanup(): number {
    try {
      const keys = Object.keys(localStorage);
      const cacheKeys = keys.filter(k => k.startsWith(this.prefix));
      let cleaned = 0;

      cacheKeys.forEach(key => {
        const value = localStorage.getItem(key);
        if (!value) return;

        try {
          const entry = JSON.parse(value);
          const age = Date.now() - entry.timestamp;

          if (age > entry.ttl) {
            localStorage.removeItem(key);
            cleaned++;
          }
        } catch (error) {
          // Invalid entry, remove it
          localStorage.removeItem(key);
          cleaned++;
        }
      });

      if (process.env.NODE_ENV === 'development') {
        console.log(`💾 [CACHE] Cleanup: removed ${cleaned} expired entries`);
      }

      return cleaned;
    } catch (error) {
      console.warn('Cache cleanup failed:', error);
      return 0;
    }
  }

  /**
   * Check if cache entry exists and is valid
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Get or set pattern: get from cache or fetch and cache
   */
  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number = 5 * 60 * 1000
  ): Promise<T> {
    // Try to get from cache
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Fetch fresh data
    const data = await fetcher();
    
    // Save to cache
    this.save(key, data, ttl);
    
    return data;
  }

  /**
   * Update cache entry without changing TTL
   */
  update<T>(key: string, updater: (current: T | null) => T): void {
    try {
      const cached = localStorage.getItem(`${this.prefix}${key}`);
      let ttl = 5 * 60 * 1000; // Default TTL

      // Get existing TTL if available
      if (cached) {
        try {
          const entry = JSON.parse(cached);
          ttl = entry.ttl;
        } catch (error) {
          // Use default TTL
        }
      }

      const current = this.get<T>(key);
      const updated = updater(current);
      this.save(key, updated, ttl);
    } catch (error) {
      console.warn('Cache update failed:', error);
    }
  }

  /**
   * Invalidate cache entries related to a vendor
   */
  invalidateVendor(vendorId: string): void {
    this.clearPattern(vendorId);
  }

  /**
   * Invalidate dashboard cache
   */
  invalidateDashboard(vendorId: string): void {
    this.remove(`dashboard_${vendorId}`);
    this.remove(`schedule_${vendorId}`);
    this.remove(`notifications_${vendorId}`);
  }
}

// Export singleton instance
export const cacheManager = new CacheManager();

// Auto-cleanup on page load
if (typeof window !== 'undefined') {
  // Clean up expired entries on load
  setTimeout(() => {
    cacheManager.cleanup();
  }, 1000);

  // Periodic cleanup every 5 minutes
  setInterval(() => {
    cacheManager.cleanup();
  }, 5 * 60 * 1000);
}

export default cacheManager;
