/**
 * ============================================================================
 * REGION ENDPOINTS - SQL-ONLY VERSION (REWRITTEN FOR RELIABILITY)
 * ============================================================================
 * 
 * CRITICAL FIX: This file has been completely rewritten to ensure:
 * 1. OPTIONS handlers work even if repository initialization fails
 * 2. All handlers are wrapped in try-catch
 * 3. CORS headers are always returned
 * 4. No top-level code that can crash during module loading
 * 
 * Date: 2024-12-25
 * Migration: Phase 5 - KV to SQL
 * ============================================================================
 */

import { Hono } from 'npm:hono@4';

// ✅ CRITICAL: Define CORS headers function FIRST - never throws
function getCorsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, Cache-Control, Pragma',
    'Access-Control-Max-Age': '86400',
  };
}

// ✅ CRITICAL: Simple OPTIONS response - never throws
function handleOptions(c: any) {
  try {
    const headers = getCorsHeaders();
    Object.entries(headers).forEach(([key, value]) => {
      c.header(key, value);
    });
    return c.text('', 204);
  } catch (err) {
    // Ultimate fallback - just return 204
    console.error('❌ [REGION] Error in OPTIONS handler:', err);
    c.header('Access-Control-Allow-Origin', '*');
    return c.text('', 204);
  }
}

export function regionEndpoints(app: Hono) {
  // ✅ CRITICAL: Register OPTIONS handlers FIRST - before any repository calls
  // These MUST work even if everything else fails
  
  // Specific route: /regions/active
  app.options('/make-server-3dd53475/regions/active', handleOptions);
  
  // Specific route: /regions/india
  app.options('/make-server-3dd53475/regions/india', handleOptions);
  
  // Parametric route: /regions/:regionId
  app.options('/make-server-3dd53475/regions/:regionId', handleOptions);
  
  // Wildcard fallback: /regions/*
  app.options('/make-server-3dd53475/regions/*', handleOptions);
  
  // ✅ Now register GET handlers with proper error handling
  // Lazy import repositories to avoid crashes during module loading
  
  // Health check endpoint
  app.get('/make-server-3dd53475/region-health', async (c) => {
    try {
      c.header('Access-Control-Allow-Origin', '*');
      return c.json({
        success: true,
        message: 'Region endpoints are loaded and working!',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('❌ [REGION] Health check error:', error);
      c.header('Access-Control-Allow-Origin', '*');
      return c.json({ success: false, error: String(error) }, 500);
    }
  });

  // Get all regions
  app.get('/make-server-3dd53475/regions', async (c) => {
    try {
      const { getRegionsRepository } = await import('../../lib/repositories/regions.ts');
      const regionsRepo = getRegionsRepository();
      const regions = await regionsRepo.findAll();
      
      const mappedRegions = regions.map(r => ({
        regionId: r.code,
        regionName: r.name,
        regionCode: r.code,
        country: r.country || 'India',
        serviceCatalog: r.region_config?.serviceCatalog || {},
        isActive: r.is_active,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        ...r.region_config,
      }));
      
      c.header('Access-Control-Allow-Origin', '*');
      return c.json({
        success: true,
        regions: mappedRegions,
        count: mappedRegions.length,
      });
    } catch (error) {
      console.error('❌ [REGION] Error fetching regions:', error);
      c.header('Access-Control-Allow-Origin', '*');
      return c.json({
        success: false,
        error: 'Failed to fetch regions',
        details: String(error),
      }, 500);
    }
  });

  // Get active regions only
  app.get('/make-server-3dd53475/regions/active', async (c) => {
    try {
      const { getRegionsRepository } = await import('../../lib/repositories/regions.ts');
      const { getDbClient } = await import('../../lib/db.ts');
      const regionsRepo = getRegionsRepository();
      const db = getDbClient();
      const regions = await regionsRepo.findActive();
      
      // ✅ FIX: Load services from service_catalog table instead of region_config
      const { data: services, error: servicesError } = await db
        .from('service_catalog')
        .select('*')
        .eq('status', 'active')
        .eq('publish_status', 'published')
        .order('display_order', { ascending: true });
      
      if (servicesError) {
        console.warn('⚠️ [REGION] Could not fetch services:', servicesError);
      }
      
      // Map services to serviceCatalog format
      const serviceCatalog = (services || []).map((svc: any) => ({
        serviceId: svc.service_id,
        serviceName: svc.service_name,
        displayName: svc.display_name || svc.service_name,
        category: svc.category_name,
        subCategory: svc.sub_category_name,
        serviceStyle: svc.service_style,
        basePrice: Number(svc.base_price) || 0,
        durationMinutes: svc.duration_minutes || 30,
        status: svc.status,
      }));
      
      const mappedRegions = regions.map(r => ({
        regionId: r.code,
        regionName: r.name,
        regionCode: r.code,
        country: r.country_code || 'India',
        serviceCatalog: serviceCatalog, // ✅ Use services from service_catalog table
        serviceCount: serviceCatalog.length,
        isActive: r.is_active,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));
      
      c.header('Access-Control-Allow-Origin', '*');
      return c.json({
        success: true,
        regions: mappedRegions,
      });
    } catch (error) {
      console.error('❌ [REGION] Error fetching active regions:', error);
      c.header('Access-Control-Allow-Origin', '*');
      return c.json({
        success: false,
        error: 'Failed to fetch active regions',
        details: String(error),
      }, 500);
    }
  });

  // Get specific region by ID
  app.get('/make-server-3dd53475/regions/:regionId', async (c) => {
    try {
      const regionId = c.req.param('regionId');
      
      if (!regionId) {
        c.header('Access-Control-Allow-Origin', '*');
        return c.json({
          success: false,
          error: 'regionId parameter is required',
        }, 400);
      }
      
      const { getRegionsRepository } = await import('../../lib/repositories/regions.ts');
      const regionsRepo = getRegionsRepository();
      const region = await regionsRepo.findByCode(regionId);
      
      if (!region) {
        c.header('Access-Control-Allow-Origin', '*');
        return c.json({
          success: false,
          error: 'Region not found',
        }, 404);
      }
      
      // Get enabled roles (optional - don't fail if this fails)
      let enabledRoles: any[] = [];
      try {
        const { getRegionRolesRepository } = await import('../../lib/repositories/region-roles.ts');
        const regionRolesRepo = getRegionRolesRepository();
        enabledRoles = await regionRolesRepo.getEnabledRoles(region.code);
      } catch (err) {
        console.warn('⚠️ [REGION] Could not fetch enabled roles:', err);
      }
      
      // ✅ FIX: Load services from service_catalog table
      const { getDbClient } = await import('../../lib/db.ts');
      const db = getDbClient();
      const { data: services, error: servicesError } = await db
        .from('service_catalog')
        .select('*')
        .eq('status', 'active')
        .eq('publish_status', 'published')
        .order('display_order', { ascending: true });
      
      if (servicesError) {
        console.warn('⚠️ [REGION] Could not fetch services:', servicesError);
      }
      
      // Map services to serviceCatalog format
      const serviceCatalog = (services || []).map((svc: any) => ({
        serviceId: svc.service_id,
        serviceName: svc.service_name,
        displayName: svc.display_name || svc.service_name,
        category: svc.category_name,
        subCategory: svc.sub_category_name,
        serviceStyle: svc.service_style,
        basePrice: Number(svc.base_price) || 0,
        durationMinutes: svc.duration_minutes || 30,
        status: svc.status,
      }));
      
      const mappedRegion = {
        regionId: region.code,
        regionName: region.name,
        regionCode: region.code,
        country: region.country_code || 'India',
        serviceCatalog: serviceCatalog, // ✅ Use services from service_catalog table
        serviceCount: serviceCatalog.length,
        enabledRoles: enabledRoles.map(rr => ({
          roleId: rr.role_id,
          roleName: rr.role_name,
        })),
        enabledRolesCount: enabledRoles.length,
        isActive: region.is_active,
        createdAt: region.created_at,
        updatedAt: region.updated_at,
      };
      
      c.header('Access-Control-Allow-Origin', '*');
      return c.json({
        success: true,
        region: mappedRegion,
      });
    } catch (error) {
      console.error('❌ [REGION] Error fetching region:', error);
      c.header('Access-Control-Allow-Origin', '*');
      return c.json({
        success: false,
        error: 'Failed to fetch region',
        details: String(error),
      }, 500);
    }
  });

  // Get region services
  app.get('/make-server-3dd53475/region-services', async (c) => {
    try {
      const regionId = c.req.query('regionId') || 'india';
      const { getRegionsRepository } = await import('../../lib/repositories/regions.ts');
      const regionsRepo = getRegionsRepository();
      const region = await regionsRepo.findByCode(regionId);
      
      if (!region) {
        c.header('Access-Control-Allow-Origin', '*');
        return c.json({
          success: false,
          error: 'Region not found',
        }, 404);
      }
      
      c.header('Access-Control-Allow-Origin', '*');
      return c.json({
        success: true,
        services: region.region_config?.serviceCatalog || {},
        regionId: region.code,
        regionName: region.name,
      });
    } catch (error) {
      console.error('❌ [REGION] Error fetching region services:', error);
      c.header('Access-Control-Allow-Origin', '*');
      return c.json({
        success: false,
        error: 'Failed to fetch region services',
      }, 500);
    }
  });

  // Admin endpoints (with authentication - can be added later)
  app.get('/make-server-3dd53475/admin/regions', async (c) => {
    try {
      const { getRegionsRepository } = await import('../../lib/repositories/regions.ts');
      const regionsRepo = getRegionsRepository();
      const regions = await regionsRepo.findAll();
      
      const mappedRegions = regions.map(r => ({
        regionId: r.code,
        regionName: r.name,
        regionCode: r.code,
        country: r.country || 'India',
        serviceCatalog: r.region_config?.serviceCatalog || {},
        isActive: r.is_active,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        ...r.region_config,
      }));
      
      c.header('Access-Control-Allow-Origin', '*');
      return c.json({
        success: true,
        regions: mappedRegions,
      });
    } catch (error) {
      console.error('❌ [REGION] Error fetching regions:', error);
      c.header('Access-Control-Allow-Origin', '*');
      return c.json({
        success: false,
        error: 'Failed to fetch regions',
      }, 500);
    }
  });

  // ✅ CRITICAL: Register OPTIONS for admin routes too
  app.options('/make-server-3dd53475/admin/regions', handleOptions);
  app.options('/make-server-3dd53475/admin/regions/*', handleOptions);
  
  console.log('✅ [REGION] Region endpoints registered successfully (SQL-only, defensive)');
}
