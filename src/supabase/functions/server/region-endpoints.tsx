// Region Management Endpoints
// Backend API for multi-region configuration

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { Region, REGION_TEMPLATES } from './region-types.tsx';

export function regionEndpoints(app: any, kvStore: any) {
  try {
    console.log('🌍 [REGION] Registering region endpoints...');
    
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
      const regions = await kvStore.getByPrefix<Region>('region_');
      console.log(`🌍 [REGION] Found ${regions?.length || 0} regions`);
      
      return c.json({
        success: true,
        regions: regions || [],
        count: regions?.length || 0,
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
      const regions = await kvStore.getByPrefix<Region>('region_');
      const activeRegions = regions?.filter(r => r.isActive) || [];
      
      return c.json({
        success: true,
        regions: activeRegions,
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
      const region = await kvStore.get<Region>(`region_${regionId}`);
      
      if (!region) {
        return c.json({
          success: false,
          error: 'Region not found',
        }, 404);
      }
      
      return c.json({
        success: true,
        region,
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
      const region = await kvStore.get<Region>(`region_${regionId}`);
      
      if (!region) {
        return c.json({
          success: false,
          error: 'Region not found',
        }, 404);
      }
      
      return c.json({
        success: true,
        services: region.serviceCatalog,
        regionId: region.regionId,
        regionName: region.regionName,
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
      const regions = await kvStore.getByPrefix<Region>('region_');
      
      return c.json({
        success: true,
        regions: regions || [],
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
      const existing = await kvStore.get<Region>(`region_${regionId}`);
      if (existing) {
        return c.json({
          success: false,
          error: 'Region already exists',
        }, 400);
      }
      
      // Get template or use provided data
      let regionData: Region;
      if (templateId && REGION_TEMPLATES[templateId]) {
        regionData = {
          ...REGION_TEMPLATES[templateId],
          regionId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as Region;
      } else {
        regionData = {
          ...body,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }
      
      // Save region
      await kvStore.set(`region_${regionId}`, regionData);
      
      return c.json({
        success: true,
        region: regionData,
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
      
      const existing = await kvStore.get<Region>(`region_${regionId}`);
      if (!existing) {
        return c.json({
          success: false,
          error: 'Region not found',
        }, 404);
      }
      
      const updated: Region = {
        ...existing,
        ...updates,
        regionId, // Don't allow changing the ID
        updatedAt: new Date().toISOString(),
      };
      
      await kvStore.set(`region_${regionId}`, updated);
      
      return c.json({
        success: true,
        region: updated,
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
      
      const existing = await kvStore.get<Region>(`region_${regionId}`);
      if (!existing) {
        return c.json({
          success: false,
          error: 'Region not found',
        }, 404);
      }
      
      const updated: Region = {
        ...existing,
        isActive,
        updatedAt: new Date().toISOString(),
      };
      
      await kvStore.set(`region_${regionId}`, updated);
      
      return c.json({
        success: true,
        region: updated,
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
      const existing = await kvStore.get<Region>(`region_${regionId}`);
      if (existing) {
        return c.json({
          success: true,
          message: `${REGION_TEMPLATES[templateId].regionName} region already exists`,
          region: existing,
        });
      }
      
      // Create region from template
      const newRegion: Region = {
        ...REGION_TEMPLATES[templateId],
        regionId,
        isActive: templateId === 'india', // Only India is active by default
        launchDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as Region;
      
      await kvStore.set(`region_${regionId}`, newRegion);
      
      console.log(`✅ Region ${regionId} initialized successfully`);
      
      return c.json({
        success: true,
        message: `${newRegion.regionName} region initialized successfully`,
        region: newRegion,
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
        const existing = await kvStore.get<Region>(`region_${regionId}`);
        
        if (existing) {
          results.push({ regionId, status: 'skipped', message: 'Already exists' });
          continue;
        }
        
        // Create from template
        const newRegion: Region = {
          ...template,
          regionId,
          // Ensure ONLY India is active by default
          isActive: templateId === 'india',
          launchDate: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as Region;
        
        await kvStore.set(`region_${regionId}`, newRegion);
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
    
    console.log('✅ [REGION] All region endpoints registered successfully');
  } catch (error) {
    console.error('❌❌❌ [REGION] FATAL ERROR registering region endpoints:', error);
    console.error('❌❌❌ [REGION] Stack:', error?.stack);
    throw error; // Re-throw to see the error in server logs
  }
}
