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
  
  // ✅ SEED ENDPOINT: Uses existing service creation logic (SQL-only)
  app.post("/make-server-3dd53475/admin/catalog/seed-all-services", async (c) => {
    try {
      const body = await c.req.json();
      const { confirm = false } = body;
      
      // Import and generate service catalog
      const { generateComprehensiveServiceCatalog } = await import('./admin-service-catalog-sql.tsx');
      const serviceCatalog = generateComprehensiveServiceCatalog();
      
      if (!confirm) {
        // Return preview
        const previewServices = serviceCatalog.services.slice(0, 50);
        return c.json({
          success: true,
          preview: true,
          services: previewServices,
          stats: {
            totalServices: serviceCatalog.services.length,
            categoriesSeeded: serviceCatalog.categories.length,
            breakdown: serviceCatalog.breakdown,
            previewCount: previewServices.length,
            hasMore: serviceCatalog.services.length > previewServices.length
          },
          message: `Review the services below (showing ${previewServices.length} of ${serviceCatalog.services.length}) and confirm to seed the catalog`
        });
      }
      
      // Use existing endpoint logic - insert into service_catalog table
      // Optimized: Batch insert for better performance
      let inserted = 0;
      let skipped = 0;
      const errors: string[] = [];
      const servicesToInsert: any[] = [];
      
      // Get all unique service name + category combinations to check
      const serviceKeys = new Set<string>();
      const serviceMap = new Map<string, any>();
      
      for (const service of serviceCatalog.services) {
        const serviceName = service.service_name || service.display_name || '';
        const categoryName = service.category_name || service.category_id || 'general';
        const key = `${serviceName}::${categoryName}`;
        
        if (serviceName && !serviceKeys.has(key)) {
          serviceKeys.add(key);
          serviceMap.set(key, service);
        }
      }
      
      // Batch check existing services (check all unique combinations)
      const uniqueServiceNames = Array.from(serviceKeys).map(k => k.split('::')[0]);
      const uniqueCategoryNames = Array.from(serviceKeys).map(k => k.split('::')[1]);
      
      const { data: existingServices } = await db
        .from('service_catalog')
        .select('service_name, category_name')
        .in('service_name', uniqueServiceNames.length > 0 ? uniqueServiceNames : [''])
        .in('category_name', uniqueCategoryNames.length > 0 ? uniqueCategoryNames : ['']);
      
      const existingMap = new Set(
        (existingServices || []).map((s: any) => `${s.service_name}::${s.category_name}`)
      );
      
      // Prepare services for batch insert
      for (const [key, service] of serviceMap.entries()) {
        try {
          if (existingMap.has(key)) {
            skipped++;
            continue;
          }
          
          const serviceName = key.split('::')[0];
          const categoryName = key.split('::')[1];
          
          // Use same insert logic as POST /admin/service-catalog endpoint
          const serviceId = `service_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          servicesToInsert.push({
            service_id: serviceId,
            service_name: serviceName,
            display_name: service.display_name || serviceName,
            description: service.description || '',
            category_id: service.category_id || categoryName,
            category_name: categoryName,
            sub_category_id: service.sub_category_id || service.sub_category_name,
            sub_category_name: service.sub_category_name || service.sub_category_id || categoryName,
            applicable_roles: service.applicable_roles || [],
            service_style: service.service_style || 'at_center',
            base_price: Number(service.base_price) || 0,
            duration_minutes: Number(service.duration_minutes) || 30,
            status: 'active',
            publish_status: 'published',
            metadata: service.metadata || {},
            display_order: service.display_order || 0
          });
        } catch (err) {
          errors.push(`${service.service_name || 'unknown'}: ${String(err)}`);
          skipped++;
        }
      }
      
      // Batch insert services (50 at a time to avoid timeout)
      const BATCH_SIZE = 50;
      for (let i = 0; i < servicesToInsert.length; i += BATCH_SIZE) {
        const batch = servicesToInsert.slice(i, i + BATCH_SIZE);
        try {
          const { error: insertError } = await db
            .from('service_catalog')
            .insert(batch);
          
          if (insertError) {
            errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${insertError.message}`);
            skipped += batch.length;
          } else {
            inserted += batch.length;
          }
        } catch (err) {
          errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${String(err)}`);
          skipped += batch.length;
        }
      }
      
      return c.json({
        success: true,
        stats: {
          totalServices: serviceCatalog.services.length,
          inserted,
          skipped,
          errors: errors.length,
          categoriesSeeded: serviceCatalog.categories.length,
          breakdown: serviceCatalog.breakdown
        },
        errors: errors.slice(0, 10)
      });
    } catch (error) {
      console.error('Error seeding services:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
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
   * ✅ MIGRATED: Reads from service_catalog table (not services table)
   */
  app.get("/make-server-3dd53475/admin/service-catalog", async (c) => {
    try {
      // ✅ SQL: Get all services from service_catalog table
      const { data: services, error } = await db
        .from('service_catalog')
        .select('*')
        .order('display_order', { ascending: true })
        .order('category_name', { ascending: true })
        .order('service_name', { ascending: true });
      
      if (error) throw error;
      
      // Ensure backward compatibility fields if needed
      const servicesWithDetails = (services || []).map((svc: any) => ({
        id: svc.id,
        catalogId: svc.id,
        serviceId: svc.service_id,
        serviceName: svc.service_name,
        displayName: svc.display_name || svc.service_name,
        description: svc.description || '',
        categoryId: svc.category_id,
        categoryName: svc.category_name,
        subCategoryId: svc.sub_category_id,
        subCategoryName: svc.sub_category_name,
        applicableRoles: svc.applicable_roles || [],
        serviceStyle: svc.service_style || 'at_center',
        basePrice: parseFloat(svc.base_price || '0'),
        duration: svc.duration_minutes || 30,
        status: svc.status || 'active',
        publishStatus: svc.publish_status || 'published',
        metadata: svc.metadata || {},
        displayOrder: svc.display_order || 0
      }));

      return c.json({ success: true, services: servicesWithDetails, count: servicesWithDetails.length });
    } catch (error) {
      console.error('Error fetching service catalog:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/admin/service-catalog
   * Create a new service (Add to service_catalog table)
   * ✅ MIGRATED: Uses service_catalog table
   */
  app.post("/make-server-3dd53475/admin/service-catalog", async (c) => {
    try {
      const data = await c.req.json();
      
      if (!data.serviceName || !data.categoryId) {
        return c.json({ error: 'Service name and Category ID are required' }, 400);
      }

      // Generate unique service_id
      const serviceId = `service_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // ✅ SQL: Create service in service_catalog table
      const { data: newService, error } = await db
        .from('service_catalog')
        .insert({
          service_id: serviceId,
          service_name: data.serviceName,
          display_name: data.displayName || data.serviceName,
          description: data.description || '',
          category_id: data.categoryId,
          category_name: data.categoryName || data.categoryId,
          sub_category_id: data.subCategoryId,
          sub_category_name: data.subCategoryName,
          applicable_roles: data.applicableRoles || [],
          service_style: data.serviceStyle || 'at_center',
          base_price: Number(data.basePrice) || 0,
          duration_minutes: Number(data.duration) || 30,
          status: data.status || 'active',
          publish_status: data.publishStatus || 'published',
          metadata: data.metadata || {},
          display_order: data.displayOrder || 0
        })
        .select()
        .single();

      if (error) throw error;

      return c.json({ 
        success: true, 
        service: {
          id: newService.id,
          catalogId: newService.id,
          serviceId: newService.service_id,
          serviceName: newService.service_name,
          displayName: newService.display_name,
          basePrice: parseFloat(newService.base_price || '0'),
          duration: newService.duration_minutes || 30,
          status: newService.status || 'active'
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
   * ✅ MIGRATED: Uses service_catalog table
   */
  app.put("/make-server-3dd53475/admin/service-catalog/:catalogId", async (c) => {
    try {
      const catalogId = c.req.param('catalogId');
      const updates = await c.req.json();
      
      // ✅ SQL: Update service in service_catalog table
      const updateData: any = {
        updated_at: new Date().toISOString()
      };
      
      if (updates.serviceName) updateData.service_name = updates.serviceName;
      if (updates.displayName) updateData.display_name = updates.displayName;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.categoryId) updateData.category_id = updates.categoryId;
      if (updates.categoryName) updateData.category_name = updates.categoryName;
      if (updates.subCategoryId) updateData.sub_category_id = updates.subCategoryId;
      if (updates.subCategoryName) updateData.sub_category_name = updates.subCategoryName;
      if (updates.applicableRoles) updateData.applicable_roles = updates.applicableRoles;
      if (updates.serviceStyle) updateData.service_style = updates.serviceStyle;
      if (updates.basePrice !== undefined) updateData.base_price = Number(updates.basePrice);
      if (updates.duration !== undefined) updateData.duration_minutes = Number(updates.duration);
      if (updates.status !== undefined) updateData.status = updates.status;
      if (updates.publishStatus !== undefined) updateData.publish_status = updates.publishStatus;
      if (updates.displayOrder !== undefined) updateData.display_order = updates.displayOrder;
      if (updates.metadata) updateData.metadata = updates.metadata;
      
      const { data: updatedService, error } = await db
        .from('service_catalog')
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
          id: updatedService.id,
          catalogId: updatedService.id,
          serviceId: updatedService.service_id,
          serviceName: updatedService.service_name,
          displayName: updatedService.display_name,
          basePrice: parseFloat(updatedService.base_price || '0'),
          duration: updatedService.duration_minutes || 30,
          status: updatedService.status || 'active'
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
   * ✅ MIGRATED: Uses service_catalog table
   */
  app.delete("/make-server-3dd53475/admin/service-catalog/:catalogId", async (c) => {
    try {
      const catalogId = c.req.param('catalogId');
      
      // ✅ SQL: Delete service from service_catalog table
      const { error } = await db
        .from('service_catalog')
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

