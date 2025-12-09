import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";
import { getProblemGridByRole } from "./problem-grid-catalog.tsx";
import { sendSuccess, sendError } from "./response-utils.ts";

export function registerVendorServiceEndpoints(app: Hono) {
  
  /**
   * GET /make-server-3dd53475/vendor/services/:vendorId
   * Get all services for a vendor
   */
  app.get("/make-server-3dd53475/vendor/services/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      // Get vendor profile
      const vendor = await kv.get(`vendor:${vendorId}`);
      if (!vendor) {
        return sendError(c, 'Vendor not found', 404);
      }

      // Get vendor services
      // Services are stored in a list: vendor:{vendorId}:services -> [serviceId1, serviceId2, ...]
      // And detailed service objects: service:{serviceId}
      
      let serviceIds = await kv.get(`vendor:${vendorId}:services`) || [];
      
      // ✅ SELF-HEALING: Check for orphaned services if list is empty
      if (serviceIds.length === 0) {
        console.log(`🔍 No services found in index for ${vendorId}. Checking for orphaned services...`);
        try {
          const allServices = await kv.getByPrefix('service:');
          const orphanedServices = allServices.filter((s: any) => 
            s.vendorId === vendorId && 
            s.isActive !== false
          );
          
          if (orphanedServices.length > 0) {
            console.log(`🔧 Found ${orphanedServices.length} orphaned services. Rebuilding index...`);
            serviceIds = orphanedServices.map((s: any) => s.id);
            await kv.set(`vendor:${vendorId}:services`, serviceIds);
          }
        } catch (err) {
          console.warn('⚠️ Error checking for orphaned services:', err);
        }
      }

      const services = [];
      for (const id of serviceIds) {
        const service = await kv.get(`service:${id}`);
        if (service && service.isActive !== false) {
          services.push(service);
        }
      }

      return sendSuccess(c, {
        services,
        vendorId,
        count: services.length
      });
    } catch (error) {
      console.error('Error fetching vendor services:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /make-server-3dd53475/vendor/:vendorId/services/:serviceStyle
   * Get services for a specific style (at_home, at_center, tele)
   */
  app.get("/make-server-3dd53475/vendor/:vendorId/services/:serviceStyle", async (c) => {
    try {
      const { vendorId, serviceStyle } = c.req.param();
      
      // Get vendor services
      const serviceIds = await kv.get(`vendor:${vendorId}:services`) || [];
      
      const services = [];
      for (const id of serviceIds) {
        const service = await kv.get(`service:${id}`);
        // Filter by active status AND style
        // We check both 'type' and 'serviceStyle' properties to be safe
        if (service && service.isActive !== false) {
          if (service.type === serviceStyle || service.serviceStyle === serviceStyle) {
            services.push(service);
          }
        }
      }

      return sendSuccess(c, {
        services,
        vendorId,
        serviceStyle,
        count: services.length
      });
    } catch (error) {
      console.error(`Error fetching services for style ${c.req.param('serviceStyle')}:`, error);
      return sendError(c, error, 500);
    }
  });


  /**
   * GET /make-server-3dd53475/vendor/problem-grid-specializations/:roleId
   * Get specializations for the problem grid based on role
   */
  app.get("/make-server-3dd53475/vendor/problem-grid-specializations/:roleId", async (c) => {
    try {
      const { roleId } = c.req.param();
      
      console.log(`🔍 Fetching specializations for role: ${roleId}`);
      
      // Use the shared source of truth for problem grids
      const specializations = getProblemGridByRole(roleId);
      
      return sendSuccess(c, {
        specializations,
        roleId,
        count: specializations.length
      });
    } catch (error) {
      console.error('Error fetching specializations:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/vendor/services/add
   * Add a new service to vendor catalog
   */
  app.post("/make-server-3dd53475/vendor/services/add", async (c) => {
    try {
      const { vendorId, serviceData } = await c.req.json();
      
      if (!vendorId || !serviceData) {
        return sendError(c, 'Missing required fields', 400);
      }

      const serviceId = `svc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const newService = {
        id: serviceId,
        vendorId,
        ...serviceData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isActive: true
      };
      
      console.log(`\n💾 [SERVICE-PERSISTENCE] Creating service...`);
      console.log(`   Service ID: ${serviceId}`);
      console.log(`   Vendor ID: ${vendorId}`);
      console.log(`   Service Type: ${serviceData.type || serviceData.serviceStyle}`);
      
      // Save service object
      await kv.set(`service:${serviceId}`, newService);
      console.log(`   ✅ Service object saved to KV: service:${serviceId}`);
      
      // Add to vendor's service list
      const serviceIds = await kv.get(`vendor:${vendorId}:services`) || [];
      console.log(`   📋 Current service count for vendor: ${serviceIds.length}`);
      
      if (!serviceIds.includes(serviceId)) {
        serviceIds.push(serviceId);
        await kv.set(`vendor:${vendorId}:services`, serviceIds);
        console.log(`   ✅ Service ID added to vendor's service list`);
      } else {
        console.log(`   ⚠️  Service ID already in vendor's list (duplicate)`);
      }
      
      // ✅ PERSISTENCE VERIFICATION
      const verifyService = await kv.get(`service:${serviceId}`);
      const verifyList = await kv.get(`vendor:${vendorId}:services`);
      
      if (verifyService && verifyList && verifyList.includes(serviceId)) {
        console.log(`   ✅ PERSISTENCE VERIFIED: Service successfully persisted`);
      } else {
        console.error(`   ❌ PERSISTENCE FAILED: Service not found after save`);
        console.error(`      - Service object exists: ${!!verifyService}`);
        console.error(`      - Service in vendor list: ${verifyList?.includes(serviceId)}`);
      }

      return sendSuccess(c, { service: newService }, 'Service added successfully');
    } catch (error) {
      console.error('❌ [SERVICE-PERSISTENCE] Error adding vendor service:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * PUT /make-server-3dd53475/vendor/services/:serviceId
   * Update a service
   */
  app.put("/make-server-3dd53475/vendor/services/:serviceId", async (c) => {
    try {
      const { serviceId } = c.req.param();
      const updates = await c.req.json();
      
      const service = await kv.get(`service:${serviceId}`);
      if (!service) {
        return sendError(c, 'Service not found', 404);
      }

      const updatedService = {
        ...service,
        ...updates,
        updatedAt: new Date().toISOString()
      };
      
      await kv.set(`service:${serviceId}`, updatedService);
      
      return sendSuccess(c, { service: updatedService }, 'Service updated successfully');
    } catch (error) {
      console.error('Error updating service:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * DELETE /make-server-3dd53475/vendor/services/:serviceId
   * Delete/Archive a service
   */
  app.delete("/make-server-3dd53475/vendor/services/:serviceId", async (c) => {
    try {
      const { serviceId } = c.req.param();
      const { vendorId } = await c.req.query();
      
      // Instead of hard delete, we might want to soft delete or just remove from list
      // For now, we'll remove from list and mark inactive
      
      const service = await kv.get(`service:${serviceId}`);
      if (service) {
        service.isActive = false;
        await kv.set(`service:${serviceId}`, service);
      }

      if (vendorId) {
        const serviceIds = await kv.get(`vendor:${vendorId}:services`) || [];
        const updatedIds = serviceIds.filter((id: string) => id !== serviceId);
        await kv.set(`vendor:${vendorId}:services`, updatedIds);
      }

      return sendSuccess(c, {}, 'Service removed successfully');
    } catch (error) {
      console.error('Error deleting service:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /make-server-3dd53475/catalog/services/master
   * Get master catalog services for vendors to select from
   * ✅ FIXED: Now uses V2 Architecture (Flat Service Catalog + catalog:categories)
   */
  app.get("/make-server-3dd53475/catalog/services/master", async (c) => {
    try {
      const { category, subCategory, roleId } = c.req.query();
      
      // 1. Get Categories (Correct Key: catalog:categories)
      const categories = await kv.get('catalog:categories') || [];
      
      // 2. Get Services (Correct Key: platform:service_catalog)
      // In V2, services are stored flat, not nested in categories
      const allMasterServices = await kv.get('platform:service_catalog') || [];
      
      // 3. Filter and Enrich
      let filteredServices = allMasterServices.filter((svc: any) => {
          // Active status check (support both legacy 'status' and new 'isActive')
          const isActive = svc.status === 'active' || svc.isActive === true;
          if (!isActive) return false;

          // Category Filter
          if (category && svc.categoryId !== category) return false;

          // SubCategory Filter (if service has subCategoryId)
          if (subCategory && svc.subCategoryId && svc.subCategoryId !== subCategory) return false;

          // Role Filter
          if (roleId) {
              const roles = svc.applicableRoles || [];
              // Check if roleId is in the applicableRoles array
              // Or if applicableRoles includes 'all'
              const matchesRole = Array.isArray(roles) && (roles.includes(roleId) || roles.includes('all'));
              
              // Also support legacy single 'role' field if exists
              const legacyMatch = svc.role === roleId || svc.role === 'all';
              
              if (!matchesRole && !legacyMatch) return false;
          }
          
          return true;
      });

      // 4. Add Category Names for UI display
      const servicesWithNames = filteredServices.map((svc: any) => {
          const cat = categories.find((c: any) => c.id === svc.categoryId);
          
          // Try to find subcategory name if possible
          let subName = '';
          if (cat && cat.subCategories && svc.subCategoryId) {
              const sub = cat.subCategories.find((s: any) => s.id === svc.subCategoryId);
              if (sub) subName = sub.name;
          }
          
          return {
              ...svc,
              categoryName: cat?.name || 'Unknown Category',
              subCategoryName: subName,
              // Ensure a key exists for React lists
              uniqueKey: svc.id || `svc_${svc.serviceName}_${Math.random()}`
          };
      });
      
      return sendSuccess(c, {
        services: servicesWithNames,
        count: servicesWithNames.length
      });
    } catch (error) {
      console.error('Error fetching master catalog services:', error);
      return sendError(c, error, 500);
    }
  });
}