/**
 * ============================================================================
 * REGION ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * Region management endpoints for multi-region configuration
 * 
 * CHANGES:
 * - Removed `kvStore` parameter from function signature
 * - Replaced all `kv.get()`, `kv.set()`, `kv.getByPrefix()` with repository calls
 * - All regions stored in regions table
 * 
 * Date: 2024-12-22
 * Migration: Phase 5 - KV to SQL
 * ============================================================================
 */

import { Hono } from 'npm:hono';
import { getRegionsRepository } from '../../lib/repositories/regions.ts';
import { REGION_TEMPLATES } from './region-types.tsx';

export function regionEndpoints(app: Hono) {
  try {
    console.log('🌍 [REGION] Registering region endpoints (SQL-only)...');
    
    const regionsRepo = getRegionsRepository();
    
    // Health check endpoint to verify region endpoints are loaded
    app.get('/make-server-3dd53475/region-health', async (c) => {
      console.log('🌍 [REGION] Health check called');
      return c.json({
        success: true,
        message: 'Region endpoints are loaded and working!',
        timestamp: new Date().toISOString(),
      });
    });

    // Get all regions
    app.get('/make-server-3dd53475/regions', async (c) => {
      try {
        console.log('🌍 [REGION] GET /regions called');
        const regions = await regionsRepo.findAll();
        console.log(`🌍 [REGION] Found ${regions.length} regions`);
        
        // Map SQL schema to Region type format
        const mappedRegions = regions.map(r => ({
          regionId: r.code,
          regionName: r.name,
          regionCode: r.code,
          country: r.country || 'India',
          serviceCatalog: r.region_config?.serviceCatalog || {},
          isActive: r.is_active,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
          ...r.region_config, // Include any additional config
        }));
        
        return c.json({
          success: true,
          regions: mappedRegions,
          count: mappedRegions.length,
        });
      } catch (error) {
        console.error('❌ [REGION] Error fetching regions:', error);
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
        console.log('🌍 [REGION] GET /regions/active called');
        const regions = await regionsRepo.findActive();
        
        // Map SQL schema to Region type format
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
        
        return c.json({
          success: true,
          regions: mappedRegions,
        });
      } catch (error) {
        console.error('Error fetching active regions:', error);
        return c.json({
          success: false,
          error: 'Failed to fetch active regions',
        }, 500);
      }
    });

    // Get specific region by ID
    app.get('/make-server-3dd53475/regions/:regionId', async (c) => {
      try {
        const regionId = c.req.param('regionId');
        const region = await regionsRepo.findByCode(regionId);
        
        if (!region) {
          return c.json({
            success: false,
            error: 'Region not found',
          }, 404);
        }
        
        // Map SQL schema to Region type format
        const mappedRegion = {
          regionId: region.code,
          regionName: region.name,
          regionCode: region.code,
          country: region.country || 'India',
          serviceCatalog: region.region_config?.serviceCatalog || {},
          isActive: region.is_active,
          createdAt: region.created_at,
          updatedAt: region.updated_at,
          ...region.region_config,
        };
        
        return c.json({
          success: true,
          region: mappedRegion,
        });
      } catch (error) {
        console.error('Error fetching region:', error);
        return c.json({
          success: false,
          error: 'Failed to fetch region',
        }, 500);
      }
    });

    // Get region services (enabled services for a region)
    app.get('/make-server-3dd53475/region-services', async (c) => {
      try {
        const regionId = c.req.query('regionId') || 'india';
        const region = await regionsRepo.findByCode(regionId);
        
        if (!region) {
          return c.json({
            success: false,
            error: 'Region not found',
          }, 404);
        }
        
        return c.json({
          success: true,
          services: region.region_config?.serviceCatalog || {},
          regionId: region.code,
          regionName: region.name,
        });
      } catch (error) {
        console.error('Error fetching region services:', error);
        return c.json({
          success: false,
          error: 'Failed to fetch region services',
        }, 500);
      }
    });

    // Get all regions (Admin) - same as /regions but under /admin prefix
    app.get('/make-server-3dd53475/admin/regions', async (c) => {
      try {
        console.log('🌍 [REGION] GET /admin/regions called');
        const regions = await regionsRepo.findAll();
        
        // Map SQL schema to Region type format
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
        
        return c.json({
          success: true,
          regions: mappedRegions,
        });
      } catch (error) {
        console.error('Error fetching regions:', error);
        return c.json({
          success: false,
          error: 'Failed to fetch regions',
        }, 500);
      }
    });

    // Create new region (Admin only)
    app.post('/make-server-3dd53475/admin/regions', async (c) => {
      try {
        const body = await c.req.json();
        const { regionId, templateId } = body;
        
        if (!regionId) {
          return c.json({
            success: false,
            error: 'Region ID is required',
          }, 400);
        }
        
        // Check if region already exists
        const existing = await regionsRepo.findByCode(regionId);
        if (existing) {
          return c.json({
            success: false,
            error: 'Region already exists',
          }, 400);
        }
        
        // Get template or use provided data
        let regionData: any;
        if (templateId && REGION_TEMPLATES[templateId]) {
          const template = REGION_TEMPLATES[templateId];
          regionData = {
            name: template.regionName,
            code: regionId,
            country: template.country || 'India',
            region_config: {
              ...template,
              regionId,
            },
            is_active: true,
          };
        } else {
          regionData = {
            name: body.regionName || body.name || regionId,
            code: regionId,
            country: body.country || 'India',
            region_config: body,
            is_active: body.isActive ?? true,
          };
        }
        
        // Save region
        const created = await regionsRepo.create(regionData);
        
        return c.json({
          success: true,
          region: {
            regionId: created.code,
            regionName: created.name,
            regionCode: created.code,
            country: created.country,
            serviceCatalog: created.region_config?.serviceCatalog || {},
            isActive: created.is_active,
            createdAt: created.created_at,
            updatedAt: created.updated_at,
            ...created.region_config,
          },
          message: `Region ${regionId} created successfully`,
        });
      } catch (error) {
        console.error('Error creating region:', error);
        return c.json({
          success: false,
          error: 'Failed to create region',
        }, 500);
      }
    });

    // Update region (Admin only)
    app.put('/make-server-3dd53475/admin/regions/:regionId', async (c) => {
      try {
        const regionId = c.req.param('regionId');
        const updates = await c.req.json();
        
        const existing = await regionsRepo.findByCode(regionId);
        if (!existing) {
          return c.json({
            success: false,
            error: 'Region not found',
          }, 404);
        }
        
        // Map updates to SQL schema
        const sqlUpdates: any = {};
        if (updates.regionName || updates.name) {
          sqlUpdates.name = updates.regionName || updates.name;
        }
        if (updates.country) {
          sqlUpdates.country = updates.country;
        }
        if (updates.serviceCatalog || updates.region_config) {
          sqlUpdates.region_config = {
            ...existing.region_config,
            ...updates,
            regionId: existing.code, // Preserve regionId
          };
        }
        if (updates.isActive !== undefined) {
          sqlUpdates.is_active = updates.isActive;
        }
        
        const updated = await regionsRepo.update(regionId, sqlUpdates);
        
        return c.json({
          success: true,
          region: {
            regionId: updated.code,
            regionName: updated.name,
            regionCode: updated.code,
            country: updated.country,
            serviceCatalog: updated.region_config?.serviceCatalog || {},
            isActive: updated.is_active,
            createdAt: updated.created_at,
            updatedAt: updated.updated_at,
            ...updated.region_config,
          },
          message: `Region ${regionId} updated successfully`,
        });
      } catch (error) {
        console.error('Error updating region:', error);
        return c.json({
          success: false,
          error: 'Failed to update region',
        }, 500);
      }
    });

    // Activate/Deactivate region (Admin only)
    app.patch('/make-server-3dd53475/admin/regions/:regionId/status', async (c) => {
      try {
        const regionId = c.req.param('regionId');
        const { isActive } = await c.req.json();
        
        const updated = await regionsRepo.setActive(regionId, isActive);
        
        return c.json({
          success: true,
          region: {
            regionId: updated.code,
            regionName: updated.name,
            regionCode: updated.code,
            country: updated.country,
            serviceCatalog: updated.region_config?.serviceCatalog || {},
            isActive: updated.is_active,
            createdAt: updated.created_at,
            updatedAt: updated.updated_at,
            ...updated.region_config,
          },
          message: `Region ${regionId} ${isActive ? 'activated' : 'deactivated'} successfully`,
        });
      } catch (error) {
        console.error('Error updating region status:', error);
        return c.json({
          success: false,
          error: 'Failed to update region status',
        }, 500);
      }
    });

    // Get available templates
    app.get('/make-server-3dd53475/admin/region-templates', async (c) => {
      try {
        console.log('🌍 [REGION] GET /admin/region-templates called');
        return c.json({
          success: true,
          templates: Object.keys(REGION_TEMPLATES).map(key => ({
            id: key,
            name: REGION_TEMPLATES[key].regionName,
            code: REGION_TEMPLATES[key].regionCode,
          })),
        });
      } catch (error) {
        console.error('Error fetching templates:', error);
        return c.json({
          success: false,
          error: 'Failed to fetch templates',
        }, 500);
      }
    });

    // Initialize region from template (seed data)
    app.post('/make-server-3dd53475/admin/regions/init-:templateId', async (c) => {
      try {
        const templateId = c.req.param('templateId');
        console.log(`🌍 [REGION] POST /admin/regions/init-${templateId} called`);
        
        // Check if template exists
        if (!REGION_TEMPLATES[templateId]) {
          return c.json({
            success: false,
            error: `Template "${templateId}" not found`,
          }, 404);
        }
        
        const regionId = templateId; // Template ID is the region ID
        
        // Check if region already exists
        const existing = await regionsRepo.findByCode(regionId);
        if (existing) {
          return c.json({
            success: true,
            message: `${REGION_TEMPLATES[templateId].regionName} region already exists`,
            region: {
              regionId: existing.code,
              regionName: existing.name,
              regionCode: existing.code,
              country: existing.country,
              serviceCatalog: existing.region_config?.serviceCatalog || {},
              isActive: existing.is_active,
              createdAt: existing.created_at,
              updatedAt: existing.updated_at,
              ...existing.region_config,
            },
          });
        }
        
        // Create region from template
        const template = REGION_TEMPLATES[templateId];
        const newRegion = await regionsRepo.create({
          name: template.regionName,
          code: regionId,
          country: template.country || 'India',
          region_config: {
            ...template,
            regionId,
            launchDate: new Date().toISOString(),
          },
          is_active: templateId === 'india', // Only India is active by default
        });
        
        console.log(`✅ Region ${regionId} initialized successfully`);
        
        return c.json({
          success: true,
          message: `${newRegion.name} region initialized successfully`,
          region: {
            regionId: newRegion.code,
            regionName: newRegion.name,
            regionCode: newRegion.code,
            country: newRegion.country,
            serviceCatalog: newRegion.region_config?.serviceCatalog || {},
            isActive: newRegion.is_active,
            createdAt: newRegion.created_at,
            updatedAt: newRegion.updated_at,
            ...newRegion.region_config,
          },
        });
      } catch (error) {
        console.error('Error initializing region:', error);
        return c.json({
          success: false,
          error: String(error),
        }, 500);
      }
    });

    // Seed ALL regions (Singapore, UAE, EMEA, UK, US, Australia)
    app.post('/make-server-3dd53475/admin/regions/seed-all', async (c) => {
      try {
        console.log('🌍 [REGION] POST /admin/regions/seed-all called');
        
        const results = [];
        const templateKeys = Object.keys(REGION_TEMPLATES);
        
        for (const templateId of templateKeys) {
          const template = REGION_TEMPLATES[templateId];
          const regionId = template.regionId; // e.g. 'india', 'singapore'
          
          // Check if exists
          const existing = await regionsRepo.findByCode(regionId);
          
          if (existing) {
            results.push({ regionId, status: 'skipped', message: 'Already exists' });
            continue;
          }
          
          // Create from template
          const newRegion = await regionsRepo.create({
            name: template.regionName,
            code: regionId,
            country: template.country || 'India',
            region_config: {
              ...template,
              regionId,
              launchDate: new Date().toISOString(),
            },
            // Ensure ONLY India is active by default
            is_active: templateId === 'india',
          });
          
          results.push({ regionId, status: 'created', message: 'Seeded successfully' });
          console.log(`✅ Region ${regionId} seeded.`);
        }
        
        return c.json({
          success: true,
          message: 'Multi-region seeding complete',
          results,
        });
        
      } catch (error) {
        console.error('Error seeding all regions:', error);
        return c.json({
          success: false,
          error: String(error),
        }, 500);
      }
    });
    
    console.log('✅ [REGION] All region endpoints registered successfully (SQL-only)');
  } catch (error) {
    console.error('❌❌❌ [REGION] FATAL ERROR registering region endpoints:', error);
    console.error('❌❌❌ [REGION] Stack:', error?.stack);
    throw error; // Re-throw to see the error in server logs
  }
}

