/**
 * ============================================================================
 * REGION ENDPOINTS - FIXED VERSION WITH PROPER DEPENDENCY REMAPPING
 * ============================================================================
 * 
 * ✅ FIXED: Proper imports, no dynamic imports, reliable initialization
 * 
 * Date: 2025-01-28
 * ============================================================================
 */

import { Hono } from 'npm:hono';
import { sendSuccess, sendError } from './response-utils.ts';
import { getRegionsRepository } from '../../lib/repositories/regions.ts';
import { getRegionRolesRepository } from '../../lib/repositories/region-roles.ts';

export function regionEndpoints(app: Hono) {
  console.log('🌍 [REGION] Registering region endpoints (SQL-only, fixed)...');
  console.log('🌍 [REGION] Route: GET /make-server-3dd53475/regions');
  
  const regionsRepo = getRegionsRepository();
  
  // ✅ CRITICAL: Register OPTIONS handlers FIRST
  app.options('/make-server-3dd53475/regions', (c) => {
    c.header('Access-Control-Allow-Origin', '*');
    c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
    return c.text('', 204);
  });
  
  app.options('/make-server-3dd53475/regions/*', (c) => {
    c.header('Access-Control-Allow-Origin', '*');
    c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
    return c.text('', 204);
  });

  // Health check endpoint
  app.get('/make-server-3dd53475/region-health', async (c) => {
    try {
      return sendSuccess(c, {
        message: 'Region endpoints are loaded and working!',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      return sendError(c, error, 500);
    }
  });

  // Get all regions
  app.get('/make-server-3dd53475/regions', async (c) => {
    try {
      console.log('🌍 [REGION] ✅ Route handler called for GET /make-server-3dd53475/regions');
      const regions = await regionsRepo.findAll();
      console.log(`🌍 [REGION] Found ${regions.length} regions`);
      
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
      
      return sendSuccess(c, {
        regions: mappedRegions,
        count: mappedRegions.length,
      });
    } catch (error) {
      console.error('❌ [REGION] Error fetching regions:', error);
      return sendError(c, error, 500);
    }
  });

  // Get active regions only
  app.get('/make-server-3dd53475/regions/active', async (c) => {
    try {
      const regions = await regionsRepo.findActive();
      
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
      
      return sendSuccess(c, {
        regions: mappedRegions,
        count: mappedRegions.length,
      });
    } catch (error) {
      console.error('❌ [REGION] Error fetching active regions:', error);
      return sendError(c, error, 500);
    }
  });

  // Get specific region by ID
  app.get('/make-server-3dd53475/regions/:regionId', async (c) => {
    try {
      const regionId = c.req.param('regionId');
      
      if (!regionId) {
        return sendError(c, 'regionId parameter is required', 400);
      }
      
      const region = await regionsRepo.findByCode(regionId);
      
      if (!region) {
        return sendError(c, 'Region not found', 404);
      }
      
      // Get enabled roles (optional - don't fail if this fails)
      let enabledRoles: any[] = [];
      try {
        const regionRolesRepo = getRegionRolesRepository();
        enabledRoles = await regionRolesRepo.getEnabledRoles(region.code);
      } catch (err) {
        console.warn('⚠️ [REGION] Could not fetch enabled roles:', err);
      }
      
      const mappedRegion = {
        regionId: region.code,
        regionName: region.name,
        regionCode: region.code,
        country: region.country || 'India',
        serviceCatalog: region.region_config?.serviceCatalog || {},
        enabledRoles: enabledRoles.map(rr => ({
          roleId: rr.role_id,
          roleName: rr.role_name,
        })),
        enabledRolesCount: enabledRoles.length,
        isActive: region.is_active,
        createdAt: region.created_at,
        updatedAt: region.updated_at,
        ...region.region_config,
      };
      
      return sendSuccess(c, { region: mappedRegion });
    } catch (error) {
      console.error('❌ [REGION] Error fetching region:', error);
      return sendError(c, error, 500);
    }
  });

  // Get region services
  app.get('/make-server-3dd53475/region-services', async (c) => {
    try {
      const regionId = c.req.query('regionId') || 'india';
      const region = await regionsRepo.findByCode(regionId);
      
      if (!region) {
        return sendError(c, 'Region not found', 404);
      }
      
      return sendSuccess(c, {
        services: region.region_config?.serviceCatalog || {},
        regionId: region.code,
        regionName: region.name,
      });
    } catch (error) {
      console.error('❌ [REGION] Error fetching region services:', error);
      return sendError(c, error, 500);
    }
  });

  // Admin endpoints
  app.get('/make-server-3dd53475/admin/regions', async (c) => {
    try {
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
      
      return sendSuccess(c, { regions: mappedRegions });
    } catch (error) {
      console.error('❌ [REGION] Error fetching regions:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ [REGION] Region endpoints registered successfully');
}

