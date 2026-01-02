// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
import { Hono } from "hono";
import { 
  getServiceCategoriesRepository,
  getDbClient
} from '../../../supabase/lib/repositories/index';

export function registerAdminCatalogEndpoints(app: Hono) {
  
  /**
   * GET /make-server-3dd53475/admin/catalog/categories
   * Get all categories
   */
  app.get("/make-server-3dd53475/admin/catalog/categories", async (c) => {
    try {
      // ✅ SQL: Get categories from service_categories table
      const db = getDbClient();
      const { data: categories } = await db
        .from('service_categories')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });
      
      // If no categories exist, return empty array (seeding should be done separately)
      const finalCategories = categories || [];
      
      return c.json({ success: true, categories });
    } catch (error) {
      console.error('Error fetching categories:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * GET /make-server-3dd53475/admin/service-catalog
   * Get all services as a flat list (for Admin UI)
   * Reads from platform:service_catalog (V2 Flat Architecture)
   */
  app.get("/make-server-3dd53475/admin/service-catalog", async (c) => {
    try {
      // ✅ SQL: Get service catalog from service_catalog table
      const db = getDbClient();
      const { data: services } = await db
        .from('service_catalog')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      
      const serviceList = services || [];
      
      // Ensure backward compatibility fields if needed
      const servicesWithDetails = serviceList.map((svc: any) => ({
        ...svc,
        catalogId: svc.id || svc.catalog_id,
        // Ensure numeric values are numbers
        basePrice: Number(svc.base_price || svc.basePrice || 0),
        duration: Number(svc.duration || svc.duration_minutes || 0)
      }));

      return c.json({ success: true, services: servicesWithDetails, count: serviceList.length });
    } catch (error) {
      console.error('Error fetching service catalog:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/admin/service-catalog
   * Create a new service (Add to platform:service_catalog)
   */
  app.post("/make-server-3dd53475/admin/service-catalog", async (c) => {
    try {
      const data = await c.req.json();
      
      if (!data.serviceName || !data.categoryId) {
        return c.json({ error: 'Service name and Category ID are required' }, 400);
      }

      // ✅ SQL: Get service catalog from service_catalog table
      const db = getDbClient();
      const { data: services } = await db
        .from('service_catalog')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      
      // ✅ SQL: Create service in service_catalog table
      const { data: newService, error } = await db
        .from('service_catalog')
        .insert({
          service_name: data.serviceName,
          category_id: data.categoryId,
          base_price: data.basePrice || 0,
          duration: data.duration || 30,
          description: data.description || null,
          status: 'active',
          ...data
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      return c.json({ 
        success: true, 
        service: {
          ...newService,
          catalogId: newService.id,
          serviceName: newService.service_name,
          basePrice: newService.base_price
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
      
      // ✅ SQL: Get service catalog from service_catalog table
      const db = getDbClient();
      const { data: services } = await db
        .from('service_catalog')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      
      // ✅ SQL: Update service in service_catalog table
      const updateData: any = {
        updated_at: new Date().toISOString()
      };
      
      if (updates.serviceName) updateData.service_name = updates.serviceName;
      if (updates.basePrice !== undefined) updateData.base_price = updates.basePrice;
      if (updates.duration !== undefined) updateData.duration = updates.duration;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.categoryId) updateData.category_id = updates.categoryId;
      if (updates.status) updateData.status = updates.status;
      
      const { data: updatedService, error } = await db
        .from('service_catalog')
        .update(updateData)
        .eq('id', catalogId)
        .select()
        .single();

      if (error || !updatedService) {
        return c.json({ error: 'Service not found' }, 404);
      }

      return c.json({ 
        success: true, 
        service: {
          ...updatedService,
          catalogId: updatedService.id,
          serviceName: updatedService.service_name,
          basePrice: updatedService.base_price
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
      
      // ✅ SQL: Get service catalog from service_catalog table
      const db = getDbClient();
      const { data: services } = await db
        .from('service_catalog')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      
      // ✅ SQL: Soft delete service in service_catalog table (set status = 'deleted')
      const { error } = await db
        .from('service_catalog')
        .update({ status: 'deleted', updated_at: new Date().toISOString() })
        .eq('id', catalogId);

      if (error) {
        return c.json({ error: 'Service not found' }, 404);
      }

      return c.json({ success: true, message: 'Service deleted successfully' });
    } catch (error) {
      console.error('Error deleting service:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/admin/catalog/update-realistic-prices
   * Update prices in V2 catalog
   */
  app.post("/make-server-3dd53475/admin/catalog/update-realistic-prices", async (c) => {
    try {
       // ✅ SQL: Get service catalog from service_catalog table
      const db = getDbClient();
      const { data: services } = await db
        .from('service_catalog')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      
      // ✅ SQL: Update prices in service_catalog table
      const { data: allServices } = await db
        .from('service_catalog')
        .select('id, base_price');
       
      let updatedCount = 0;
       
      // Update services with string prices
      for (const svc of allServices || []) {
        if (typeof svc.base_price === 'string') {
          await db
            .from('service_catalog')
            .update({ base_price: parseFloat(svc.base_price) || 0 })
            .eq('id', svc.id);
          updatedCount++;
        }
      }
       
       return c.json({
         success: true,
         stats: {
           updated: updatedCount,
           skipped: (allServices?.length || 0) - updatedCount
         }
       });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });
}