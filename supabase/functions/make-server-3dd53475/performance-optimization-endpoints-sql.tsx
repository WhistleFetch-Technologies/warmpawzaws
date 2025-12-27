/**
 * ============================================================================
 * PERFORMANCE OPTIMIZATION ENDPOINTS - SQL VERSION
 * ============================================================================
 * 
 * Caching layer, query optimization, and performance monitoring
 * Replaces: cache_stats, cache_*, performance_metrics, vendor_*, service_* KV keys
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { Hono } from 'npm:hono';
import { getDbClient } from '../../lib/db.ts';
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { getServicesRepository } from '../../lib/repositories/services.ts';

// Cache configuration for different data types
const CACHE_TTL = {
  vendorCatalog: 300, // 5 minutes
  serviceDiscovery: 600, // 10 minutes
  userSession: 1800, // 30 minutes
  popularSearches: 900, // 15 minutes
  staticContent: 3600, // 1 hour
  analytics: 180 // 3 minutes
};

export function performanceOptimizationEndpointsSQL(app: Hono) {
  const db = getDbClient();
  const vendorsRepo = getVendorsRepository();
  const servicesRepo = getServicesRepository();

  /**
   * GET /cache/stats - Get cache statistics
   */
  app.get('/make-server-3dd53475/cache/stats', async (c) => {
  try {
    const db = getDbClient();
    const today = new Date().toISOString().split('T')[0];
    
    // ✅ SQL: Get cache stats from database
    const { data: stats, error } = await db
      .from('cache_stats')
      .select('*')
      .eq('stat_date', today)
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      console.error('Error fetching cache stats:', error);
    }
    
    const cacheStats = stats || {
      hits: 0,
      misses: 0,
      evictions: 0,
      stat_date: today
    };
    
    const hitRate = (cacheStats.hits + cacheStats.misses) > 0
      ? cacheStats.hits / (cacheStats.hits + cacheStats.misses)
      : 0;
    
    return c.json({ 
      success: true, 
      stats: {
        hits: cacheStats.hits,
        misses: cacheStats.misses,
        hitRate: hitRate,
        totalKeys: 0, // Can be calculated from cache_tokens if needed
        lastReset: cacheStats.created_at || new Date().toISOString()
      }
    });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch cache stats' }, 500);
  }
});

  /**
   * POST /cache/clear - Clear specific cache keys or all cache
   */
  app.post('/make-server-3dd53475/cache/clear', async (c) => {
  try {
    const { pattern } = await c.req.json();
    const db = getDbClient();

    if (pattern) {
      // ✅ SQL: Clear cache keys matching pattern
      const { data: cacheEntries } = await db
        .from('cache_tokens')
        .select('cache_key')
        .like('cache_key', `%${pattern}%`);
      
      if (cacheEntries && cacheEntries.length > 0) {
        await db
          .from('cache_tokens')
          .delete()
          .like('cache_key', `%${pattern}%`);
      }
      
      return c.json({ 
        success: true, 
        message: `Cleared ${cacheEntries?.length || 0} cache keys matching pattern: ${pattern}` 
      });
    } else {
      // Reset cache stats
      const today = new Date().toISOString().split('T')[0];
      await db
        .from('cache_stats')
        .upsert({
          stat_date: today,
          hits: 0,
          misses: 0,
          evictions: 0,
          created_at: new Date().toISOString()
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
  app.get('/make-server-3dd53475/cache/vendor-catalog/:vendorId', async (c) => {
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
      .single();
    
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
    
    // ✅ SQL: Get vendor services from database
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
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString()
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
    .single();
  
  const currentStats = stats || { hits: 0, misses: 0, evictions: 0 };
  
  await db
    .from('cache_stats')
    .upsert({
      stat_date: today,
      hits: (currentStats.hits || 0) + 1,
      misses: currentStats.misses || 0,
      evictions: currentStats.evictions || 0,
      created_at: stats?.created_at || new Date().toISOString()
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
    .single();
  
  const currentStats = stats || { hits: 0, misses: 0, evictions: 0 };
  
  await db
    .from('cache_stats')
    .upsert({
      stat_date: today,
      hits: currentStats.hits || 0,
      misses: (currentStats.misses || 0) + 1,
      evictions: currentStats.evictions || 0,
      created_at: stats?.created_at || new Date().toISOString()
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
  app.get('/make-server-3dd53475/optimize/popular-services', async (c) => {
  try {
    const cacheKey = 'cache_popular_services';
    const db = getDbClient();

    // ✅ SQL: Check cache
    const { data: cached } = await db
      .from('cache_tokens')
      .select('*')
      .eq('cache_key', cacheKey)
      .gt('expires_at', new Date().toISOString())
      .single();

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

    // ✅ SQL: Fetch popular services from database
    const servicesRepo = getServicesRepository();
    const allServices = await servicesRepo.findAll();
    
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
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString()
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
  app.get('/make-server-3dd53475/optimize/vendor-search', async (c) => {
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
      .single();

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

    // ✅ SQL: Fetch vendors from database
    const vendorsRepo = getVendorsRepository();
    let vendors = await vendorsRepo.findAll();
    
    // Filter by query
    if (query) {
      vendors = vendors.filter((v: any) => 
        v.business_name?.toLowerCase().includes(query.toLowerCase())
      );
    }

    // Filter by category
    if (category) {
      vendors = vendors.filter((v: any) => v.role_id === category);
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

    const expiresAt = new Date(Date.now() + CACHE_TTL.serviceDiscovery * 1000);
    await db
      .from('cache_tokens')
      .upsert({
        cache_key: cacheKey,
        cache_value: JSON.stringify(result),
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString()
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
  app.get('/make-server-3dd53475/performance/metrics', async (c) => {
  try {
    const db = getDbClient();
    
    // ✅ SQL: Get performance metrics from database
    const { data: metrics } = await db
      .from('performance_metrics')
      .select('*')
      .order('recorded_at', { ascending: false })
      .limit(1000);
    
    if (!metrics || metrics.length === 0) {
      return c.json({
        success: true,
        metrics: {
          apiResponseTime: { average: 0, p50: 0, p95: 0, p99: 0 },
          databaseQueryTime: { average: 0, p50: 0, p95: 0 },
          errorRate: 0,
          requestsPerMinute: 0,
          lastUpdated: new Date().toISOString()
        }
      });
    }
    
    // Group metrics by type
    const apiResponseTimes = metrics
      .filter(m => m.metric_type === 'apiResponse')
      .map(m => ({ value: Number(m.metric_value), timestamp: m.recorded_at }));
    const dbQueryTimes = metrics
      .filter(m => m.metric_type === 'dbQuery')
      .map(m => ({ value: Number(m.metric_value), timestamp: m.recorded_at }));
    const errorRates = metrics
      .filter(m => m.metric_type === 'error')
      .map(m => ({ value: Number(m.metric_value), timestamp: m.recorded_at }));
    const requestCounts = metrics
      .filter(m => m.metric_type === 'request')
      .map(m => ({ value: Number(m.metric_value), timestamp: m.recorded_at }));
    
    const avgApiResponse = calculateAverage(apiResponseTimes);
    const avgDbQuery = calculateAverage(dbQueryTimes);
    const avgErrorRate = calculateAverage(errorRates);

    return c.json({
      success: true,
      metrics: {
        apiResponseTime: {
          average: avgApiResponse,
          p50: calculatePercentile(apiResponseTimes, 50),
          p95: calculatePercentile(apiResponseTimes, 95),
          p99: calculatePercentile(apiResponseTimes, 99)
        },
        databaseQueryTime: {
          average: avgDbQuery,
          p50: calculatePercentile(dbQueryTimes, 50),
          p95: calculatePercentile(dbQueryTimes, 95)
        },
        errorRate: avgErrorRate,
        requestsPerMinute: requestCounts.length > 0 
          ? requestCounts[requestCounts.length - 1].value 
          : 0,
        lastUpdated: metrics[0]?.recorded_at || new Date().toISOString()
      }
    });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch metrics' }, 500);
  }
});

  /**
   * POST /performance/track - Track performance metric
   */
  app.post('/make-server-3dd53475/performance/track', async (c) => {
  try {
    const { type, value, timestamp } = await c.req.json();
    const db = getDbClient();

    // ✅ SQL: Store performance metric
    await db
      .from('performance_metrics')
      .insert({
        metric_name: `${type}_${Date.now()}`,
        metric_value: value,
        metric_type: type,
        recorded_at: timestamp || new Date().toISOString()
      });

    // Keep only last 1000 entries per type (cleanup old entries)
    const { data: allMetrics } = await db
      .from('performance_metrics')
      .select('id')
      .eq('metric_type', type)
      .order('recorded_at', { ascending: false });
    
    if (allMetrics && allMetrics.length > 1000) {
      const idsToDelete = allMetrics.slice(1000).map(m => m.id);
      await db
        .from('performance_metrics')
        .delete()
        .in('id', idsToDelete);
    }

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
  app.get('/make-server-3dd53475/health', async (c) => {
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
  app.get('/make-server-3dd53475/health/detailed', async (c) => {
  try {
    const db = getDbClient();
    
    const checks = {
      database: await checkDatabaseHealth(db),
      cache: await checkCacheHealth(db),
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

async function checkDatabaseHealth(db: any): Promise<boolean> {
  try {
    // Simple query to check database connectivity
    await db.from('health_checks').select('id').limit(1);
    return true;
  } catch {
    return false;
  }
}

async function checkCacheHealth(db: any): Promise<boolean> {
  try {
    const { data } = await db
      .from('cache_stats')
      .select('id')
      .limit(1);
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
  app.post('/make-server-3dd53475/batch/vendors', async (c) => {
  try {
    const { vendorIds } = await c.req.json();

    if (!Array.isArray(vendorIds) || vendorIds.length === 0) {
      return c.json({ success: false, error: 'Invalid vendorIds array' }, 400);
    }

    const db = getDbClient();
    const vendorsRepo = getVendorsRepository();
    
    // ✅ SQL: Batch fetch vendors
    const vendors = await Promise.all(
      vendorIds.map(async (id) => {
        // Check cache first
        const cacheKey = `cache_vendor_${id}`;
        const { data: cached } = await db
          .from('cache_tokens')
          .select('*')
          .eq('cache_key', cacheKey)
          .gt('expires_at', new Date().toISOString())
          .single();
        
        if (cached) {
          return JSON.parse(cached.cache_value);
        }

        // Fetch from database
        const vendor = await vendorsRepo.findById(id);
        if (vendor) {
          // Cache it
          const expiresAt = new Date(Date.now() + CACHE_TTL.vendorCatalog * 1000);
          await db
            .from('cache_tokens')
            .upsert({
              cache_key: cacheKey,
              cache_value: JSON.stringify(vendor),
              expires_at: expiresAt.toISOString(),
              created_at: new Date().toISOString()
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
  app.post('/make-server-3dd53475/batch/services', async (c) => {
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

  console.log('✅ Performance optimization endpoints registered (SQL-only)');
}
