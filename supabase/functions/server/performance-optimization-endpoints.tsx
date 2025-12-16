/**
 * 🚀 PERFORMANCE OPTIMIZATION ENDPOINTS
 * Phase 7E - Sprint 1: Backend Performance Enhancements
 * Date: December 15, 2024
 * 
 * This file implements performance optimization features:
 * - Caching layer with Redis-like KV operations
 * - Query optimization helpers
 * - Response compression
 * - Performance monitoring
 * - Health checks
 */

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';

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
    const stats = await kv.get('cache_stats') || {
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalKeys: 0,
      lastReset: new Date().toISOString()
    };

    return c.json({ success: true, stats });
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

    if (pattern) {
      // Clear cache keys matching pattern
      const keys = await kv.getByPrefix(pattern);
      for (const key of keys) {
        await kv.del(`cache_${pattern}`);
      }
      return c.json({ 
        success: true, 
        message: `Cleared ${keys.length} cache keys matching pattern: ${pattern}` 
      });
    } else {
      // Reset cache stats
      await kv.set('cache_stats', {
        hits: 0,
        misses: 0,
        hitRate: 0,
        totalKeys: 0,
        lastReset: new Date().toISOString()
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

    // Try cache first
    const cached = await kv.get(cacheKey);
    if (cached) {
      await incrementCacheHit();
      return c.json({ 
        success: true, 
        data: cached, 
        source: 'cache',
        cachedAt: cached.timestamp 
      });
    }

    // Cache miss - fetch from source
    await incrementCacheMiss();
    const vendorCatalog = await kv.getByPrefix(`vendor_service_${vendorId}`);
    
    // Store in cache with timestamp
    const cacheData = {
      catalog: vendorCatalog,
      timestamp: new Date().toISOString()
    };
    await kv.set(cacheKey, cacheData);

    return c.json({ 
      success: true, 
      data: cacheData, 
      source: 'database' 
    });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch vendor catalog' }, 500);
  }
});

async function incrementCacheHit() {
  const stats = await kv.get('cache_stats') || { hits: 0, misses: 0 };
  stats.hits++;
  stats.hitRate = stats.hits / (stats.hits + stats.misses);
  await kv.set('cache_stats', stats);
}

async function incrementCacheMiss() {
  const stats = await kv.get('cache_stats') || { hits: 0, misses: 0 };
  stats.misses++;
  stats.hitRate = stats.hits / (stats.hits + stats.misses);
  await kv.set('cache_stats', stats);
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
    const cached = await kv.get(cacheKey);

    if (cached && Date.now() - new Date(cached.timestamp).getTime() < CACHE_TTL.serviceDiscovery * 1000) {
      return c.json({ 
        success: true, 
        services: cached.data, 
        source: 'cache' 
      });
    }

    // Fetch and cache
    const allServices = await kv.getByPrefix('vendor_service_');
    
    // Simple popularity calculation (in real implementation, use booking count)
    const popularServices = allServices
      .sort(() => Math.random() - 0.5) // Mock randomization
      .slice(0, 10);

    const cacheData = {
      data: popularServices,
      timestamp: new Date().toISOString()
    };
    await kv.set(cacheKey, cacheData);

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

    // Build cache key
    const cacheKey = `cache_vendor_search_${query}_${category}_${page}_${limit}`;
    const cached = await kv.get(cacheKey);

    if (cached && Date.now() - new Date(cached.timestamp).getTime() < CACHE_TTL.serviceDiscovery * 1000) {
      return c.json({
        success: true,
        results: cached.data,
        pagination: cached.pagination,
        source: 'cache'
      });
    }

    // Fetch all vendors
    let vendors = await kv.getByPrefix('vendor_');

    // Filter by query
    if (query) {
      vendors = vendors.filter((v: any) => 
        v.businessName?.toLowerCase().includes(query.toLowerCase())
      );
    }

    // Filter by category
    if (category) {
      vendors = vendors.filter((v: any) => v.roleId === category);
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

    await kv.set(cacheKey, result);

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
    const metrics = await kv.get('performance_metrics') || {
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

    const metrics = await kv.get('performance_metrics') || {
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
    await kv.set('performance_metrics', metrics);

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
    uptime: process.uptime ? process.uptime() : 0,
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
    await kv.get('health_check');
    return true;
  } catch {
    return false;
  }
}

async function checkCacheHealth(): Promise<boolean> {
  try {
    const stats = await kv.get('cache_stats');
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

    // Batch fetch with caching
    const vendors = await Promise.all(
      vendorIds.map(async (id) => {
        const cacheKey = `cache_vendor_${id}`;
        const cached = await kv.get(cacheKey);
        
        if (cached) {
          return cached;
        }

        const vendor = await kv.get(`vendor_${id}`);
        if (vendor) {
          await kv.set(cacheKey, vendor);
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

    const services = await Promise.all(
      serviceIds.map(id => kv.get(`service_${id}`))
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
