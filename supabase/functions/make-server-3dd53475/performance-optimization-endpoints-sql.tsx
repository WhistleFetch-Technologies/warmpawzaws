/**
 * ============================================================================
 * PERFORMANCE OPTIMIZATION ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * Features:
 * - Caching layer using SQL cache_tokens table
 * - Query optimization helpers
 * - Response compression
 * - Performance monitoring using SQL
 * - Health checks using SQL
 * 
 * CHANGES:
 * - Removed `kv` import
 * - Replaced all `kv.get()`, `kv.set()`, `kv.del()`, `kv.getByPrefix()` with SQL queries
 * - Uses `cache_tokens` table for cache data
 * - Uses `cache_stats` table for cache statistics
 * - Uses `performance_metrics` table (or JSONB in configurations) for metrics
 * - Uses `health_checks` table for health check data
 * - Uses SQL repositories for vendors and services
 * 
 * Date: 2025-01-27
 * Migration: Agent-3 - KV to SQL (Batch 5)
 * KV Operations Removed: 25
 * ============================================================================
 */

import { Hono } from 'npm:hono';
import { getDbClient } from '../../lib/db.ts';
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { getServicesRepository } from '../../lib/repositories/services.ts';

const app = new Hono();

// ==========================================
// CACHING LAYER
// ==========================================

/**
 * Cache configuration for different data types
 */
const CACHE_TTL = {
  vendorCatalog: 300, // 5 minutes
  serviceDiscovery: 600, // 10 minutes
  userSession: 1800, // 30 minutes
  popularSearches: 900, // 15 minutes
  staticContent: 3600, // 1 hour
  analytics: 180 // 3 minutes
};

/**
 * GET /cache/stats - Get cache statistics
 */
app.get('/cache/stats', async (c) => {
  try {
    // ✅ SQL: Get cache stats from cache_stats table
    const db = getDbClient();
    const today = new Date().toISOString().split('T')[0];
    
    const { data: stats } = await db
      .from('cache_stats')
      .select('*')
      .eq('stat_date', today)
      .maybeSingle();
    
    const cacheStats = stats || {
      hits: 0,
      misses: 0,
      evictions: 0,
      hitRate: 0,
      totalKeys: 0,
      lastReset: new Date().toISOString()
    };
    
    // Calculate hit rate
    const total = cacheStats.hits + cacheStats.misses;
    cacheStats.hitRate = total > 0 ? cacheStats.hits / total : 0;
    
    // Get total cache keys count
    const { count } = await db
      .from('cache_tokens')
      .select('*', { count: 'exact', head: true })
      .gt('expires_at', new Date().toISOString());
    
    cacheStats.totalKeys = count || 0;

    return c.json({ success: true, stats: cacheStats });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch cache stats' }, 500);
  }
});

/**
 * POST /cache/clear - Clear specific cache keys or all cache
 */
app.post('/cache/clear', async (c) => {
  try {
    const { pattern } = await c.req.json();
    const db = getDbClient();

    if (pattern) {
      // ✅ SQL: Clear cache keys matching pattern
      const { data: keys } = await db
        .from('cache_tokens')
        .select('cache_key')
        .like('cache_key', `%${pattern}%`);
      
      if (keys && keys.length > 0) {
        await db
          .from('cache_tokens')
          .delete()
          .like('cache_key', `%${pattern}%`);
      }
      
      return c.json({ 
        success: true, 
        message: `Cleared ${keys?.length || 0} cache keys matching pattern: ${pattern}` 
      });
    } else {
      // ✅ SQL: Reset cache stats
      const today = new Date().toISOString().split('T')[0];
      await db
        .from('cache_stats')
        .upsert({
          stat_date: today,
          hits: 0,
          misses: 0,
          evictions: 0
        }, {
          onConflict: 'stat_date'
        });
      
      return c.json({ success: true, message: 'Cache stats reset' });
    }
  } catch (error) {
    return c.json({ success: false, error: 'Failed to clear cache' }, 500);
  }
});

/**
 * GET /cache/vendor-catalog/:vendorId - Get cached vendor catalog
 */
app.get('/cache/vendor-catalog/:vendorId', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const cacheKey = `cache_vendor_catalog_${vendorId}`;
    const db = getDbClient();

    // ✅ SQL: Try cache first
    const { data: cached } = await db
      .from('cache_tokens')
      .select('*')
      .eq('cache_key', cacheKey)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (cached) {
      await incrementCacheHit(db);
      const cacheData = JSON.parse(cached.cache_value);
      return c.json({ 
        success: true, 
        data: cacheData, 
        source: 'cache',
        cachedAt: cacheData.timestamp 
      });
    }

    // Cache miss - fetch from source
    await incrementCacheMiss(db);
    
    // ✅ SQL: Get vendor services from services table
    const servicesRepo = getServicesRepository();
    const vendorServices = await servicesRepo.findByVendor(vendorId);
    
    // Store in cache with timestamp
    const cacheData = {
      catalog: vendorServices,
      timestamp: new Date().toISOString()
    };
    
    const expiresAt = new Date(Date.now() + CACHE_TTL.vendorCatalog * 1000);
    await db
      .from('cache_tokens')
      .upsert({
        cache_key: cacheKey,
        cache_value: JSON.stringify(cacheData),
        expires_at: expiresAt.toISOString()
      }, {
        onConflict: 'cache_key'
      });

    return c.json({ 
      success: true, 
      data: cacheData, 
      source: 'database' 
    });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch vendor catalog' }, 500);
  }
});

async function incrementCacheHit(db: any) {
  const today = new Date().toISOString().split('T')[0];
  const { data: stats } = await db
    .from('cache_stats')
    .select('*')
    .eq('stat_date', today)
    .maybeSingle();
  
  const hits = (stats?.hits || 0) + 1;
  const misses = stats?.misses || 0;
  
  await db
    .from('cache_stats')
    .upsert({
      stat_date: today,
      hits: hits,
      misses: misses,
      evictions: stats?.evictions || 0
    }, {
      onConflict: 'stat_date'
    });
}

async function incrementCacheMiss(db: any) {
  const today = new Date().toISOString().split('T')[0];
  const { data: stats } = await db
    .from('cache_stats')
    .select('*')
    .eq('stat_date', today)
    .maybeSingle();
  
  const hits = stats?.hits || 0;
  const misses = (stats?.misses || 0) + 1;
  
  await db
    .from('cache_stats')
    .upsert({
      stat_date: today,
      hits: hits,
      misses: misses,
      evictions: stats?.evictions || 0
    }, {
      onConflict: 'stat_date'
    });
}

// ==========================================
// QUERY OPTIMIZATION
// ==========================================

/**
 * GET /optimize/popular-services - Get popular services with caching
 */
app.get('/optimize/popular-services', async (c) => {
  try {
    const cacheKey = 'cache_popular_services';
    const db = getDbClient();

    // ✅ SQL: Check cache
    const { data: cached } = await db
      .from('cache_tokens')
      .select('*')
      .eq('cache_key', cacheKey)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (cached) {
      const cacheData = JSON.parse(cached.cache_value);
      if (Date.now() - new Date(cacheData.timestamp).getTime() < CACHE_TTL.serviceDiscovery * 1000) {
        return c.json({ 
          success: true, 
          services: cacheData.data, 
          source: 'cache' 
        });
      }
    }

    // ✅ SQL: Fetch popular services from services table
    const servicesRepo = getServicesRepository();
    const db = getDbClient();
    const { data: allServices } = await db
      .from('services')
      .select('*')
      .eq('is_active', true)
      .limit(1000);
    
    // Simple popularity calculation (in real implementation, use booking count)
    const popularServices = allServices
      .sort(() => Math.random() - 0.5) // Mock randomization
      .slice(0, 10);

    const cacheData = {
      data: popularServices,
      timestamp: new Date().toISOString()
    };
    
    const expiresAt = new Date(Date.now() + CACHE_TTL.serviceDiscovery * 1000);
    await db
      .from('cache_tokens')
      .upsert({
        cache_key: cacheKey,
        cache_value: JSON.stringify(cacheData),
        expires_at: expiresAt.toISOString()
      }, {
        onConflict: 'cache_key'
      });

    return c.json({ 
      success: true, 
      services: popularServices, 
      source: 'computed' 
    });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch popular services' }, 500);
  }
});

/**
 * GET /optimize/vendor-search - Optimized vendor search with pagination
 */
app.get('/optimize/vendor-search', async (c) => {
  try {
    const { 
      query, 
      page = '1', 
      limit = '20',
      category 
    } = c.req.query();

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;
    const db = getDbClient();

    // Build cache key
    const cacheKey = `cache_vendor_search_${query}_${category}_${page}_${limit}`;
    
    // ✅ SQL: Check cache
    const { data: cached } = await db
      .from('cache_tokens')
      .select('*')
      .eq('cache_key', cacheKey)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (cached) {
      const cacheData = JSON.parse(cached.cache_value);
      if (Date.now() - new Date(cacheData.timestamp).getTime() < CACHE_TTL.serviceDiscovery * 1000) {
        return c.json({
          success: true,
          results: cacheData.data,
          pagination: cacheData.pagination,
          source: 'cache'
        });
      }
    }

    // ✅ SQL: Fetch vendors from vendors table
    const vendorsRepo = getVendorsRepository();
    let vendors = await vendorsRepo.findAllActive();

    // Filter by query
    if (query) {
      vendors = vendors.filter((v: any) => 
        v.business_name?.toLowerCase().includes(query.toLowerCase())
      );
    }

    // Filter by category
    if (category) {
      vendors = vendors.filter((v: any) => v.category === category);
    }

    // Pagination
    const total = vendors.length;
    const paginatedVendors = vendors.slice(offset, offset + limitNum);

    const result = {
      data: paginatedVendors,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      },
      timestamp: new Date().toISOString()
    };

    // ✅ SQL: Store in cache
    const expiresAt = new Date(Date.now() + CACHE_TTL.serviceDiscovery * 1000);
    await db
      .from('cache_tokens')
      .upsert({
        cache_key: cacheKey,
        cache_value: JSON.stringify(result),
        expires_at: expiresAt.toISOString()
      }, {
        onConflict: 'cache_key'
      });

    return c.json({
      success: true,
      results: result.data,
      pagination: result.pagination,
      source: 'computed'
    });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to search vendors' }, 500);
  }
});

// ==========================================
// PERFORMANCE MONITORING
// ==========================================

/**
 * GET /performance/metrics - Get performance metrics
 */
app.get('/performance/metrics', async (c) => {
  try {
    // ✅ SQL: Get performance metrics from configurations table
    const db = getDbClient();
    const { data: config } = await db
      .from('configurations')
      .select('value')
      .eq('key', 'performance_metrics')
      .maybeSingle();
    
    const metrics = config?.value || {
      apiResponseTimes: [],
      databaseQueryTimes: [],
      errorRates: [],
      requestCounts: [],
      lastUpdated: new Date().toISOString()
    };

    // Calculate averages
    const avgApiResponse = calculateAverage(metrics.apiResponseTimes);
    const avgDbQuery = calculateAverage(metrics.databaseQueryTimes);
    const avgErrorRate = calculateAverage(metrics.errorRates);

    return c.json({
      success: true,
      metrics: {
        apiResponseTime: {
          average: avgApiResponse,
          p50: calculatePercentile(metrics.apiResponseTimes, 50),
          p95: calculatePercentile(metrics.apiResponseTimes, 95),
          p99: calculatePercentile(metrics.apiResponseTimes, 99)
        },
        databaseQueryTime: {
          average: avgDbQuery,
          p50: calculatePercentile(metrics.databaseQueryTimes, 50),
          p95: calculatePercentile(metrics.databaseQueryTimes, 95)
        },
        errorRate: avgErrorRate,
        requestsPerMinute: metrics.requestCounts.length > 0 
          ? metrics.requestCounts[metrics.requestCounts.length - 1] 
          : 0,
        lastUpdated: metrics.lastUpdated
      }
    });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch metrics' }, 500);
  }
});

/**
 * POST /performance/track - Track performance metric
 */
app.post('/performance/track', async (c) => {
  try {
    const { type, value, timestamp } = await c.req.json();
    const db = getDbClient();

    // ✅ SQL: Get existing metrics
    const { data: config } = await db
      .from('configurations')
      .select('value')
      .eq('key', 'performance_metrics')
      .maybeSingle();
    
    const metrics = config?.value || {
      apiResponseTimes: [],
      databaseQueryTimes: [],
      errorRates: [],
      requestCounts: []
    };

    // Add metric (keep last 1000 entries)
    switch (type) {
      case 'apiResponse':
        metrics.apiResponseTimes.push({ value, timestamp });
        if (metrics.apiResponseTimes.length > 1000) {
          metrics.apiResponseTimes = metrics.apiResponseTimes.slice(-1000);
        }
        break;
      case 'dbQuery':
        metrics.databaseQueryTimes.push({ value, timestamp });
        if (metrics.databaseQueryTimes.length > 1000) {
          metrics.databaseQueryTimes = metrics.databaseQueryTimes.slice(-1000);
        }
        break;
      case 'error':
        metrics.errorRates.push({ value, timestamp });
        if (metrics.errorRates.length > 1000) {
          metrics.errorRates = metrics.errorRates.slice(-1000);
        }
        break;
      case 'request':
        metrics.requestCounts.push({ value, timestamp });
        if (metrics.requestCounts.length > 1000) {
          metrics.requestCounts = metrics.requestCounts.slice(-1000);
        }
        break;
    }

    metrics.lastUpdated = new Date().toISOString();
    
    // ✅ SQL: Update metrics
    await db
      .from('configurations')
      .upsert({
        key: 'performance_metrics',
        value: metrics
      }, {
        onConflict: 'key'
      });

    return c.json({ success: true, message: 'Metric tracked' });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to track metric' }, 500);
  }
});

function calculateAverage(data: any[]): number {
  if (data.length === 0) return 0;
  const sum = data.reduce((acc, item) => acc + (item.value || 0), 0);
  return Math.round(sum / data.length);
}

function calculatePercentile(data: any[], percentile: number): number {
  if (data.length === 0) return 0;
  const sorted = data.map(d => d.value || 0).sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[index] || 0;
}

// ==========================================
// HEALTH CHECKS
// ==========================================

/**
 * GET /health - Basic health check
 */
app.get('/health', async (c) => {
  return c.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: 0, // Deno doesn't have process.uptime()
    version: '1.0.0'
  });
});

/**
 * GET /health/detailed - Detailed health check
 */
app.get('/health/detailed', async (c) => {
  try {
    const checks = {
      database: await checkDatabaseHealth(),
      cache: await checkCacheHealth(),
      memory: checkMemoryHealth(),
      api: true
    };

    const allHealthy = Object.values(checks).every(check => check === true);

    // ✅ SQL: Log health check
    const db = getDbClient();
    await db
      .from('health_checks')
      .insert({
        check_type: 'detailed',
        status: allHealthy ? 'healthy' : 'degraded',
        details: checks
      });

    return c.json({
      success: true,
      status: allHealthy ? 'healthy' : 'degraded',
      checks,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return c.json({
      success: false,
      status: 'unhealthy',
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const db = getDbClient();
    await db.from('health_checks').select('id').limit(1);
    return true;
  } catch {
    return false;
  }
}

async function checkCacheHealth(): Promise<boolean> {
  try {
    const db = getDbClient();
    await db.from('cache_stats').select('id').limit(1);
    return true;
  } catch {
    return false;
  }
}

function checkMemoryHealth(): boolean {
  // In Deno, we can't directly access memory stats like Node.js
  // This is a placeholder that always returns true
  return true;
}

// ==========================================
// BATCH OPERATIONS
// ==========================================

/**
 * POST /batch/vendors - Batch fetch vendors
 */
app.post('/batch/vendors', async (c) => {
  try {
    const { vendorIds } = await c.req.json();

    if (!Array.isArray(vendorIds) || vendorIds.length === 0) {
      return c.json({ success: false, error: 'Invalid vendorIds array' }, 400);
    }

    // ✅ SQL: Batch fetch vendors with caching
    const vendorsRepo = getVendorsRepository();
    const db = getDbClient();
    
    const vendors = await Promise.all(
      vendorIds.map(async (id) => {
        const cacheKey = `cache_vendor_${id}`;
        
        // Check cache
        const { data: cached } = await db
          .from('cache_tokens')
          .select('*')
          .eq('cache_key', cacheKey)
          .gt('expires_at', new Date().toISOString())
          .maybeSingle();
        
        if (cached) {
          return JSON.parse(cached.cache_value);
        }

        // Fetch from database
        const vendor = await vendorsRepo.findById(id);
        if (vendor) {
          // Store in cache
          const expiresAt = new Date(Date.now() + CACHE_TTL.userSession * 1000);
          await db
            .from('cache_tokens')
            .upsert({
              cache_key: cacheKey,
              cache_value: JSON.stringify(vendor),
              expires_at: expiresAt.toISOString()
            }, {
              onConflict: 'cache_key'
            });
        }
        return vendor;
      })
    );

    return c.json({
      success: true,
      vendors: vendors.filter(Boolean),
      count: vendors.filter(Boolean).length
    });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to batch fetch vendors' }, 500);
  }
});

/**
 * POST /batch/services - Batch fetch services
 */
app.post('/batch/services', async (c) => {
  try {
    const { serviceIds } = await c.req.json();

    if (!Array.isArray(serviceIds) || serviceIds.length === 0) {
      return c.json({ success: false, error: 'Invalid serviceIds array' }, 400);
    }

    // ✅ SQL: Batch fetch services
    const servicesRepo = getServicesRepository();
    const services = await Promise.all(
      serviceIds.map(id => servicesRepo.findById(id))
    );

    return c.json({
      success: true,
      services: services.filter(Boolean),
      count: services.filter(Boolean).length
    });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to batch fetch services' }, 500);
  }
});

export default app;

