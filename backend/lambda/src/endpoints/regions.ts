/**
 * ============================================================================
 * REGIONS MANAGEMENT ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Handles region management:
 * - Get regions
 * - Create/update regions
 * - Region configuration
 * 
 * Migrated from: supabase/functions/server/missing-crud-endpoints.tsx
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, insert, update, query } from '../database/rds-connection';

export function registerRegionEndpoints(app: Hono) {
  /**
   * GET /regions
   * Get all regions
   */
  app.get("/regions", async (c) => {
    try {
      const regions = await select('regions',
        { is_active: true },
        { orderBy: 'name', orderDirection: 'ASC' }
      );

      return c.json({
        success: true,
        regions: regions.map((r: any) => ({
          id: r.id,
          name: r.name,
          code: r.code,
          country: r.country,
          config: r.region_config || {},
        })),
        total: regions.length,
      });
    } catch (error: any) {
      console.error('Error fetching regions:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /regions/:regionId
   * Get region details
   */
  app.get("/regions/:regionId", async (c) => {
    try {
      const { regionId } = c.req.param();

      const regions = await select('regions', { id: regionId });
      if (regions.length === 0) {
        return c.json({ error: 'Region not found' }, 404);
      }

      return c.json({
        success: true,
        region: regions[0],
      });
    } catch (error: any) {
      console.error('Error fetching region:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /admin/regions
   * Create a new region
   */
  app.post("/admin/regions", async (c) => {
    try {
      const regionData = await c.req.json();
      const { name, code, country, config } = regionData;

      if (!name || !code) {
        return c.json({ error: 'name and code are required' }, 400);
      }

      const region = await insert('regions', {
        name,
        code,
        country: country || 'India',
        region_config: config || {},
        is_active: true,
      });

      return c.json({
        success: true,
        region: region[0],
        message: 'Region created successfully',
      });
    } catch (error: any) {
      console.error('Error creating region:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /admin/regions/:regionId
   * Update region
   */
  app.put("/admin/regions/:regionId", async (c) => {
    try {
      const { regionId } = c.req.param();
      const regionData = await c.req.json();

      const updated = await update('regions',
        { id: regionId },
        {
          name: regionData.name,
          code: regionData.code,
          country: regionData.country,
          region_config: regionData.config || regionData.region_config,
          is_active: regionData.isActive !== false,
        }
      );

      if (updated.length === 0) {
        return c.json({ error: 'Region not found' }, 404);
      }

      return c.json({
        success: true,
        region: updated[0],
        message: 'Region updated successfully',
      });
    } catch (error: any) {
      console.error('Error updating region:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}

