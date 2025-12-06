import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";
import { SEED_CATEGORIES, SEED_SERVICES } from "./catalog-seed-data-v2.tsx";

export function registerAdminCatalogEndpoints(app: Hono) {
  
  /**
   * POST /make-server-3dd53475/admin/catalog/seed-all-services
   * Seed all services using the V2 Flat Catalog Architecture
   */
  app.post("/make-server-3dd53475/admin/catalog/seed-all-services", async (c) => {
    try {
      console.log('\n🌱 ===== SEEDING CATALOG V2 (CORRECT ARCHITECTURE) =====');
      
      // 1. Get existing data
      const existingCategories = await kv.get('catalog:categories') || [];
      const existingServices = await kv.get('platform:service_catalog') || [];
      
      console.log(`   Existing categories: ${existingCategories.length}`);
      console.log(`   Existing services: ${existingServices.length}`);
      
      // 2. Filter new categories (avoid duplicates)
      const existingCategoryIds = new Set(existingCategories.map((c: any) => c.id));
      const newCategories = SEED_CATEGORIES.filter(c => !existingCategoryIds.has(c.id));
      
      console.log(`   New categories to add: ${newCategories.length}`);
      
      // 3. Filter new services (avoid duplicates by serviceName + categoryId + serviceStyle)
      const existingServiceKeys = new Set(
        existingServices.map((s: any) => `${s.serviceName}_${s.categoryId}_${s.serviceStyle}`)
      );
      
      const newServices = SEED_SERVICES.filter(s => 
        !existingServiceKeys.has(`${s.serviceName}_${s.categoryId}_${s.serviceStyle}`)
      );
      
      console.log(`   New services to add: ${newServices.length}`);
      
      // 4. Add timestamps and IDs to new data
      const timestamp = new Date().toISOString();
      
      const categoriesWithTimestamps = newCategories.map(cat => ({
        ...cat,
        createdAt: timestamp,
        updatedAt: timestamp
      }));
      
      const servicesWithIds = newServices.map((service, index) => {
        const id = `cat_srv_${Date.now()}_${index}`;
        return {
          ...service,
          id: id, // PRIMARY ID
          catalogId: id, // ALIAS for backward compatibility
          createdAt: timestamp,
          updatedAt: timestamp
        };
      });
      
      // 5. Merge and save
      const updatedCategories = [...existingCategories, ...categoriesWithTimestamps];
      const updatedServices = [...existingServices, ...servicesWithIds];
      
      await kv.set('catalog:categories', updatedCategories);
      await kv.set('platform:service_catalog', updatedServices);
      
      console.log(`   ✅ Added ${newCategories.length} categories`);
      console.log(`   ✅ Added ${newServices.length} services`);
      
      // 6. Calculate stats
      let categoriesSeeded = newCategories.length;
      const breakdown = SEED_CATEGORIES.map(cat => {
        const catServices = updatedServices.filter((s: any) => s.categoryId === cat.id).length;
        return { category: cat.name, services: catServices };
      });

      return c.json({
        success: true,
        message: 'All services seeded successfully',
        stats: {
          totalServices: updatedServices.length,
          categoriesSeeded,
          breakdown
        }
      });
    } catch (error) {
      console.error('Error seeding all services:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * GET /make-server-3dd53475/admin/catalog/categories
   * Get all categories
   */
  app.get("/make-server-3dd53475/admin/catalog/categories", async (c) => {
    try {
      let categories = await kv.get('catalog:categories');
      
      if (!categories || categories.length === 0) {
        // Fallback to seeded categories if empty
        categories = SEED_CATEGORIES;
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
   * Reads from platform:service_catalog (V2 Flat Architecture)
   */
  app.get("/make-server-3dd53475/admin/service-catalog", async (c) => {
    try {
      const services = await kv.get('platform:service_catalog') || [];
      
      // Ensure backward compatibility fields if needed
      const servicesWithDetails = services.map((svc: any) => ({
        ...svc,
        catalogId: svc.id || svc.catalogId,
        // Ensure numeric values are numbers
        basePrice: Number(svc.basePrice),
        duration: Number(svc.duration)
      }));

      return c.json({ success: true, services: servicesWithDetails, count: services.length });
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

      const services = await kv.get('platform:service_catalog') || [];
      
      const newService = {
        id: `svc_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        status: 'active',
        ...data,
        catalogId: undefined, // will be set to id in read
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Set catalogId = id for consistency
      newService.catalogId = newService.id;

      services.push(newService);
      
      await kv.set('platform:service_catalog', services);

      return c.json({ success: true, service: newService, message: 'Service created successfully' });
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
      
      const services = await kv.get('platform:service_catalog') || [];
      const index = services.findIndex((s: any) => (s.id === catalogId || s.catalogId === catalogId));
      
      if (index === -1) {
        return c.json({ error: 'Service not found' }, 404);
      }
      
      const updatedService = {
        ...services[index],
        ...updates,
        id: services[index].id || catalogId, // Preserve ID
        updatedAt: new Date().toISOString()
      };
      
      services[index] = updatedService;
      
      await kv.set('platform:service_catalog', services);

      return c.json({ success: true, service: updatedService, message: 'Service updated successfully' });
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
      
      const services = await kv.get('platform:service_catalog') || [];
      const filteredServices = services.filter((s: any) => s.id !== catalogId && s.catalogId !== catalogId);
      
      if (services.length === filteredServices.length) {
        return c.json({ error: 'Service not found' }, 404);
      }
      
      await kv.set('platform:service_catalog', filteredServices);

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
       const services = await kv.get('platform:service_catalog') || [];
       let updatedCount = 0;
       
       // Simplified logic: just ensure prices are numbers
       const updatedServices = services.map((s: any) => {
         if (typeof s.basePrice === 'string') {
           updatedCount++;
           return { ...s, basePrice: parseFloat(s.basePrice) || 0 };
         }
         return s;
       });
       
       if (updatedCount > 0) {
         await kv.set('platform:service_catalog', updatedServices);
       }
       
       return c.json({
         success: true,
         stats: {
           updated: updatedCount,
           skipped: services.length - updatedCount
         }
       });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });
}
