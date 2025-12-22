/**
 * ============================================================================
 * ADMIN CATALOG ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * Admin catalog management endpoints for service categories and catalog
 * 
 * CHANGES:
 * - Removed `kv` imports
 * - Replaced all `kv.get()`, `kv.set()` with SQL queries
 * - All categories stored in service_categories table
 * - All services stored in services table
 * 
 * Date: 2024-12-22
 * Migration: Phase 5 - KV to SQL
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { getDbClient } from "../../lib/db.ts";
import { getServicesRepository } from "../../lib/repositories/services.ts";

export function registerAdminCatalogEndpoints(app: Hono) {
  const db = getDbClient();
  const servicesRepo = getServicesRepository();
  
  /**
   * GET /make-server-3dd53475/admin/catalog/categories
   * Get all categories
   */
  app.get("/make-server-3dd53475/admin/catalog/categories", async (c) => {
    try {
      // ✅ SQL: Get all categories from service_categories table
      const { data: categories, error } = await db
        .from('service_categories')
        .select('*')
        .order('display_order', { ascending: true });
      
      if (error) throw error;
      
      // If no categories, return empty array (or seed default categories)
      if (!categories || categories.length === 0) {
        return c.json({ success: true, categories: [] });
      }
      
      return c.json({ success: true, categories });
    } catch (error) {
      console.error('Error fetching categories:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * GET /make-server-3dd53475/admin/service-catalog
   * Get all services as a flat list (for Admin UI)
   * Reads from services table
   */
  app.get("/make-server-3dd53475/admin/service-catalog", async (c) => {
    try {
      // ✅ SQL: Get all services from services table
      const { data: services, error } = await db
        .from('services')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Ensure backward compatibility fields if needed
      const servicesWithDetails = (services || []).map((svc: any) => ({
        ...svc,
        catalogId: svc.id,
        serviceName: svc.name,
        // Ensure numeric values are numbers
        basePrice: Number(svc.price) || 0,
        duration: Number(svc.duration_minutes) || 0,
        status: svc.is_active ? 'active' : 'inactive'
      }));

      return c.json({ success: true, services: servicesWithDetails, count: servicesWithDetails.length });
    } catch (error) {
      console.error('Error fetching service catalog:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/admin/service-catalog
   * Create a new service (Add to services table)
   */
  app.post("/make-server-3dd53475/admin/service-catalog", async (c) => {
    try {
      const data = await c.req.json();
      
      if (!data.serviceName || !data.categoryId) {
        return c.json({ error: 'Service name and Category ID are required' }, 400);
      }

      // ✅ SQL: Create service in services table
      const { data: newService, error } = await db
        .from('services')
        .insert({
          name: data.serviceName,
          description: data.description || '',
          category: data.categoryId,
          price: Number(data.basePrice) || 0,
          duration_minutes: Number(data.duration) || 0,
          is_active: data.status !== 'inactive',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      return c.json({ 
        success: true, 
        service: {
          ...newService,
          catalogId: newService.id,
          serviceName: newService.name,
          basePrice: newService.price,
          duration: newService.duration_minutes,
          status: newService.is_active ? 'active' : 'inactive'
        }, 
        message: 'Service created successfully' 
      });
    } catch (error) {
      console.error('Error creating service:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * PUT /make-server-3dd53475/admin/service-catalog/:catalogId
   * Update a service
   */
  app.put("/make-server-3dd53475/admin/service-catalog/:catalogId", async (c) => {
    try {
      const catalogId = c.req.param('catalogId');
      const updates = await c.req.json();
      
      // ✅ SQL: Update service in services table
      const updateData: any = {
        updated_at: new Date().toISOString()
      };
      
      if (updates.serviceName) updateData.name = updates.serviceName;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.categoryId) updateData.category = updates.categoryId;
      if (updates.basePrice !== undefined) updateData.price = Number(updates.basePrice);
      if (updates.duration !== undefined) updateData.duration_minutes = Number(updates.duration);
      if (updates.status !== undefined) updateData.is_active = updates.status !== 'inactive';
      
      const { data: updatedService, error } = await db
        .from('services')
        .update(updateData)
        .eq('id', catalogId)
        .select()
        .single();

      if (error) throw error;
      
      if (!updatedService) {
        return c.json({ error: 'Service not found' }, 404);
      }

      return c.json({ 
        success: true, 
        service: {
          ...updatedService,
          catalogId: updatedService.id,
          serviceName: updatedService.name,
          basePrice: updatedService.price,
          duration: updatedService.duration_minutes,
          status: updatedService.is_active ? 'active' : 'inactive'
        }, 
        message: 'Service updated successfully' 
      });
    } catch (error) {
      console.error('Error updating service:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * DELETE /make-server-3dd53475/admin/service-catalog/:catalogId
   * Delete a service
   */
  app.delete("/make-server-3dd53475/admin/service-catalog/:catalogId", async (c) => {
    try {
      const catalogId = c.req.param('catalogId');
      
      // ✅ SQL: Delete service from services table
      const { error } = await db
        .from('services')
        .delete()
        .eq('id', catalogId);

      if (error) throw error;

      return c.json({ success: true, message: 'Service deleted successfully' });
    } catch (error) {
      console.error('Error deleting service:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/admin/catalog/update-realistic-prices
   * Update prices in catalog
   */
  app.post("/make-server-3dd53475/admin/catalog/update-realistic-prices", async (c) => {
    try {
      // ✅ SQL: Get all services
      const { data: services, error: fetchError } = await db
        .from('services')
        .select('id, price');
      
      if (fetchError) throw fetchError;
      
      let updatedCount = 0;
      
      // Update services with string prices
      for (const service of services || []) {
        if (typeof service.price === 'string') {
          await db
            .from('services')
            .update({ 
              price: parseFloat(service.price) || 0,
              updated_at: new Date().toISOString()
            })
            .eq('id', service.id);
          updatedCount++;
        }
      }
      
      return c.json({
        success: true,
        stats: {
          updated: updatedCount,
          skipped: (services?.length || 0) - updatedCount
        }
      });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });
  
  console.log('✅ Admin catalog endpoints registered (SQL-only)');
}

