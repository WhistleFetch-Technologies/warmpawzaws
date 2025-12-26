import { Hono } from "npm:hono";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import { sendSuccess, sendError } from "../_shared/response-utils.ts";
import { getVendorsRepository } from "../../lib/repositories/vendors.ts";
import { getServicesRepository } from "../../lib/repositories/services.ts";
import { getStaffRepository } from "../../lib/repositories/staff.ts";
import { getBookingsRepository } from "../../lib/repositories/bookings.ts";
import { getProblemGridByRole } from "./problem-grid-catalog.tsx";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export function registerVendorServiceEndpoints(app: Hono) {
  
  /**
   * GET /make-server-3dd53475/vendor/services/:vendorId
   * Get all services for a vendor
   * ✅ FIXED: Now reads from BOTH old and new service storage systems
   */
  app.get("/make-server-3dd53475/vendor/services/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      // ✅ FIX: Use standardized vendor ID resolver
      const { resolveVendor, resolveVendorIdToUuid } = await import('../../lib/utils/vendor-id-resolver.ts');
      const vendor = await resolveVendor(vendorId);
      
      if (!vendor) {
        console.error(`❌ [VENDOR-SERVICES] Vendor not found: ${vendorId}`);
        return sendError(c, `Vendor not found: ${vendorId}`, 404);
      }

      const vendorUuid = vendor.id;
      console.log(`✅ [VENDOR-SERVICES] Resolved vendor ID: ${vendorId} -> ${vendorUuid}`);

      // ✅ SQL: Read from vendor_services table (primary source)
      const serviceStyles = ['at_home', 'at_center', 'tele'];
      const servicesByStyle: any = {};
      let allEnabledServices: any[] = [];
      
      for (const style of serviceStyles) {
        const { data: vendorServicesData, error } = await supabase
          .from('vendor_services')
          .select('*')
          .eq('vendor_id', vendorUuid)
          .eq('service_style', style)
          .eq('is_enabled', true)
          .in('publish_status', ['published', 'auto_published']);
        
        if (error) {
          console.error(`Error fetching vendor services for style ${style}:`, error);
          servicesByStyle[style] = { services: [], count: 0 };
          continue;
        }
        
        const enabledServices = (vendorServicesData || []).map((s: any) => ({
          id: s.id,
          serviceId: s.service_id,
          serviceName: s.service_name,
          name: s.service_name,
          category: s.category,
          subCategory: s.sub_category,
          price: parseFloat(s.price || s.custom_price || '0'),
          duration: s.duration_minutes || s.custom_duration || 30,
          serviceStyle: s.service_style,
          publishStatus: s.publish_status,
          isEnabled: s.is_enabled,
          isCustomService: s.is_custom_service,
          metadata: s.metadata
        }));
          
          servicesByStyle[style] = {
            services: enabledServices,
            count: enabledServices.length
          };
          
          allEnabledServices.push(...enabledServices);
      }
      
      console.log(`📋 Found ${allEnabledServices.length} enabled services from SQL vendor_services table`);

      // ✅ SQL: Also get services from services table (legacy support)
      let legacyServices: any[] = [];
      const { data: legacyServicesData } = await supabase
        .from('services')
        .select('*')
        .eq('vendor_id', vendorUuid)
        .eq('is_active', true);
      
      if (legacyServicesData && legacyServicesData.length > 0) {
        console.log(`🔍 Found ${legacyServicesData.length} services in services table`);
        legacyServices = legacyServicesData.map((s: any) => ({
          id: s.id,
          serviceId: s.id,
          serviceName: s.name,
          name: s.name,
          description: s.description,
          category: s.category,
          price: parseFloat(s.price || '0'),
          duration: s.duration_minutes || 30,
          isActive: s.is_active
        }));
      }

      return sendSuccess(c, {
        success: true,
        services: servicesByStyle, // NEW system format (grouped by style)
        allServices: allEnabledServices, // Flat array of all enabled services
        legacyServices, // OLD system services for backward compatibility
        vendorId,
        totalEnabled: allEnabledServices.length,
        totalLegacy: legacyServices.length
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
      
      // ✅ FIX: Use standardized vendor ID resolver
      const { resolveVendorIdToUuid } = await import('../../lib/utils/vendor-id-resolver.ts');
      const vendorUuid = await resolveVendorIdToUuid(vendorId);
      
      if (!vendorUuid) {
        console.error(`❌ [VENDOR-SERVICES] Vendor not found: ${vendorId}`);
        return sendError(c, `Vendor not found: ${vendorId}`, 404);
      }
      
      console.log(`✅ [VENDOR-SERVICES] Resolved vendor ID: ${vendorId} -> ${vendorUuid}`);

      const { data: vendorServicesData, error } = await supabase
        .from('vendor_services')
        .select('*')
        .eq('vendor_id', vendorUuid)
        .eq('service_style', serviceStyle)
        .eq('is_enabled', true)
        .in('publish_status', ['published', 'auto_published']);
      
      if (error) {
        console.error(`Error fetching services for style ${serviceStyle}:`, error);
        return sendError(c, error, 500);
      }

      const services = (vendorServicesData || []).map((s: any) => ({
        id: s.id,
        serviceId: s.service_id,
        serviceName: s.service_name,
        name: s.service_name,
        category: s.category,
        subCategory: s.sub_category,
        price: parseFloat(s.price || s.custom_price || '0'),
        duration: s.duration_minutes || s.custom_duration || 30,
        serviceStyle: s.service_style,
        publishStatus: s.publish_status,
        isEnabled: s.is_enabled
      }));

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
   * ✅ MIGRATED TO SQL: Uses vendor_services table
   * ✅ FIXED: Accepts both wrapped {vendorId, serviceData} and flat object formats
   */
  app.post("/make-server-3dd53475/vendor/services/add", async (c) => {
    try {
      const body = await c.req.json();
      
      // ✅ FIX: Support both formats - wrapped {vendorId, serviceData} and flat object
      let vendorId: string;
      let serviceData: any;
      
      if (body.vendorId && body.serviceData) {
        // Wrapped format: {vendorId, serviceData}
        vendorId = body.vendorId;
        serviceData = body.serviceData;
      } else if (body.vendorId && (body.catalogId || body.serviceName || body.categoryId)) {
        // Flat format: all fields at root level
        vendorId = body.vendorId;
        serviceData = {
          catalogId: body.catalogId,
          categoryId: body.categoryId,
          categoryName: body.categoryName,
          category: body.categoryName || body.category,
          subCategoryId: body.subCategoryId,
          subCategoryName: body.subCategoryName,
          subCategory: body.subCategoryName || body.subCategory,
          serviceGroupId: body.serviceGroupId,
          serviceGroupName: body.serviceGroupName,
          serviceName: body.serviceName,
          name: body.serviceName || body.name,
          serviceStyle: body.serviceStyle,
          type: body.serviceStyle,
          basePrice: body.basePrice,
          price: body.basePrice || body.price,
          customPrice: body.basePrice || body.price,
          isPackage: body.isPackage,
          packageDetails: body.packageDetails,
          description: body.description,
          customDescription: body.description,
          duration: body.duration,
          durationMinutes: body.duration,
          isActive: body.isActive,
          isEnabled: body.isActive !== false,
          publishStatus: body.publishStatus || 'published',
          isCustomService: body.isCustomService !== false,
          serviceId: body.catalogId,
          id: body.catalogId,
          metadata: body.metadata || {}
        };
      } else {
        return sendError(c, 'Missing required fields: vendorId and service data', 400);
      }
      
      if (!vendorId) {
        return sendError(c, 'Missing required field: vendorId', 400);
      }
      
      console.log(`\n💾 [SERVICE-PERSISTENCE] Creating service...`);
      console.log(`   Vendor ID: ${vendorId}`);
      console.log(`   Service Type: ${serviceData.type || serviceData.serviceStyle}`);
      
      // ✅ SQL: Get vendor UUID
      const vendorRecord = await supabase
        .from('vendors')
        .select('id, vendor_id')
        .eq('vendor_id', vendorId)
        .single();
      
      if (!vendorRecord?.data) {
        return sendError(c, 'Vendor not found', 404);
      }

      const vendorUuid = vendorRecord.data.id;
      const serviceStyle = serviceData.serviceStyle || serviceData.type || 'at_center';
      const serviceCatalogId = serviceData.serviceId || serviceData.id || `svc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // ✅ SQL: Insert into vendor_services table
      const { data: vendorService, error: insertError } = await supabase
        .from('vendor_services')
        .insert({
          vendor_id: vendorUuid,
          service_id: serviceCatalogId,
          service_name: serviceData.serviceName || serviceData.name || 'Custom Service',
          category: serviceData.category || null,
          sub_category: serviceData.subCategory || serviceData.subCategoryName || null,
          price: parseFloat(serviceData.price || serviceData.customPrice || '0'),
          duration_minutes: parseInt(serviceData.duration || serviceData.durationMinutes || '30'),
          service_style: serviceStyle,
          publish_status: serviceData.publishStatus || 'published',
          is_enabled: serviceData.isEnabled !== false,
          is_custom_service: serviceData.isCustomService || true,
          custom_price: serviceData.customPrice ? parseFloat(serviceData.customPrice) : null,
          custom_duration: serviceData.customDuration ? parseInt(serviceData.customDuration) : null,
          custom_description: serviceData.description || serviceData.customDescription || null,
          metadata: serviceData.metadata || {}
        })
        .select()
        .single();
      
      if (insertError) {
        console.error('❌ Error inserting vendor service:', insertError);
        return sendError(c, `Failed to create service: ${insertError.message}`, 500);
      }

      console.log(`   ✅ Service created in SQL: ${vendorService.id}`);

      // ✅ SQL: Auto-sync to staff for solo providers
      let autoSynced = false;
      const { data: vendorData } = await supabase
        .from('vendors')
        .select('id, metadata')
        .eq('id', vendorUuid)
        .single();
      
      const isSoloProvider = vendorData?.metadata?.isSoloProvider || false;
      
      if (isSoloProvider) {
        console.log(`   🔄 Solo provider detected - auto-syncing to staff...`);
        
        // Get staff for this vendor
        const { data: staffRecords } = await supabase
          .from('staff')
          .select('id')
          .eq('vendor_id', vendorUuid)
          .eq('is_active', true)
          .limit(1);
        
        if (staffRecords && staffRecords.length > 0) {
          const staffId = staffRecords[0].id;
          
          // Get all vendor services for this staff
          const { data: allVendorServices } = await supabase
            .from('vendor_services')
            .select('*')
            .eq('vendor_id', vendorUuid)
            .eq('is_enabled', true);
          
          // Sync to staff_services table
          if (allVendorServices && allVendorServices.length > 0) {
            const staffServicesToInsert = allVendorServices.map((vs: any) => ({
              staff_id: staffId,
              vendor_id: vendorUuid,
              service_id: vs.service_id,
              service_name: vs.service_name,
              category: vs.category,
              sub_category: vs.sub_category,
              price: vs.price,
              duration_minutes: vs.duration_minutes,
              service_style: vs.service_style,
              is_active: true,
              metadata: vs.metadata
            }));
            
            // Upsert staff services (insert or update)
            for (const ss of staffServicesToInsert) {
              await supabase
                .from('staff_services')
                .upsert(ss, { onConflict: 'staff_id,service_id' });
            }
            
            autoSynced = true;
            console.log(`   ✅ Auto-synced ${staffServicesToInsert.length} services to staff: ${staffId}`);
          }
        }
      }

      const responseService = {
        id: vendorService.id,
        serviceId: vendorService.service_id,
        serviceName: vendorService.service_name,
        name: vendorService.service_name,
        category: vendorService.category,
        subCategory: vendorService.sub_category,
        price: parseFloat(vendorService.price || '0'),
        duration: vendorService.duration_minutes || 30,
        serviceStyle: vendorService.service_style,
        publishStatus: vendorService.publish_status,
        isEnabled: vendorService.is_enabled,
        isCustomService: vendorService.is_custom_service,
        createdAt: vendorService.created_at,
        updatedAt: vendorService.updated_at
      };

      return sendSuccess(c, { 
        service: responseService, 
        autoSynced,
        message: autoSynced ? 'Service added and synced to your staff profile!' : 'Service added successfully'
      });
    } catch (error) {
      console.error('❌ [SERVICE-PERSISTENCE] Error adding vendor service:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * PUT /make-server-3dd53475/vendor/services/:serviceId
   * Update a service
   * ✅ MIGRATED TO SQL: Uses vendor_services table
   */
  app.put("/make-server-3dd53475/vendor/services/:serviceId", async (c) => {
    try {
      const { serviceId } = c.req.param();
      const updates = await c.req.json();
      
      // ✅ SQL: Get existing service
      const { data: existingService, error: fetchError } = await supabase
        .from('vendor_services')
        .select('*, vendors!inner(id, vendor_id, metadata)')
        .eq('id', serviceId)
        .single();
      
      if (fetchError || !existingService) {
        return sendError(c, 'Service not found', 404);
      }

      const vendorUuid = existingService.vendor_id;
      
      // ✅ SQL: Prepare update data
      const updateData: any = {
        updated_at: new Date().toISOString()
      };
      
      if (updates.serviceName || updates.name) {
        updateData.service_name = updates.serviceName || updates.name;
      }
      if (updates.category !== undefined) updateData.category = updates.category;
      if (updates.subCategory !== undefined || updates.subCategoryName !== undefined) {
        updateData.sub_category = updates.subCategory || updates.subCategoryName;
      }
      if (updates.price !== undefined || updates.customPrice !== undefined) {
        updateData.price = parseFloat(updates.price || updates.customPrice || '0');
      }
      if (updates.duration !== undefined || updates.durationMinutes !== undefined) {
        updateData.duration_minutes = parseInt(updates.duration || updates.durationMinutes || '30');
      }
      if (updates.serviceStyle !== undefined || updates.type !== undefined) {
        updateData.service_style = updates.serviceStyle || updates.type;
      }
      if (updates.publishStatus !== undefined) updateData.publish_status = updates.publishStatus;
      if (updates.isEnabled !== undefined) updateData.is_enabled = updates.isEnabled;
      if (updates.customPrice !== undefined) updateData.custom_price = parseFloat(updates.customPrice);
      if (updates.customDuration !== undefined) updateData.custom_duration = parseInt(updates.customDuration);
      if (updates.description !== undefined || updates.customDescription !== undefined) {
        updateData.custom_description = updates.description || updates.customDescription;
      }
      if (updates.metadata !== undefined) updateData.metadata = updates.metadata;
      
      // ✅ SQL: Update service
      const { data: updatedService, error: updateError } = await supabase
        .from('vendor_services')
        .update(updateData)
        .eq('id', serviceId)
        .select()
        .single();
      
      if (updateError) {
        console.error('Error updating service:', updateError);
        return sendError(c, `Failed to update service: ${updateError.message}`, 500);
      }
      
      // ✅ SQL: Auto-sync to staff for solo providers
      let autoSynced = false;
      const vendorMetadata = existingService.vendors?.metadata || {};
      const isSoloProvider = vendorMetadata.isSoloProvider || false;
      
      if (isSoloProvider) {
        // Get staff for this vendor
        const { data: staffRecords } = await supabase
          .from('staff')
          .select('id')
          .eq('vendor_id', vendorUuid)
          .eq('is_active', true)
          .limit(1);
        
        if (staffRecords && staffRecords.length > 0) {
          const staffId = staffRecords[0].id;
          
          // Get all vendor services
          const { data: allVendorServices } = await supabase
            .from('vendor_services')
            .select('*')
            .eq('vendor_id', vendorUuid)
            .eq('is_enabled', true);
          
          // Sync to staff_services
          if (allVendorServices && allVendorServices.length > 0) {
            for (const vs of allVendorServices) {
              await supabase
                .from('staff_services')
                .upsert({
                  staff_id: staffId,
                  vendor_id: vendorUuid,
                  service_id: vs.service_id,
                  service_name: vs.service_name,
                  category: vs.category,
                  sub_category: vs.sub_category,
                  price: vs.price,
                  duration_minutes: vs.duration_minutes,
                  service_style: vs.service_style,
                  is_active: true,
                  metadata: vs.metadata
                }, { onConflict: 'staff_id,service_id' });
            }
            
            autoSynced = true;
            console.log(`   ✅ Auto-synced updated services to staff: ${staffId}`);
          }
        }
      }
      
      const responseService = {
        id: updatedService.id,
        serviceId: updatedService.service_id,
        serviceName: updatedService.service_name,
        name: updatedService.service_name,
        category: updatedService.category,
        subCategory: updatedService.sub_category,
        price: parseFloat(updatedService.price || '0'),
        duration: updatedService.duration_minutes || 30,
        serviceStyle: updatedService.service_style,
        publishStatus: updatedService.publish_status,
        isEnabled: updatedService.is_enabled,
        updatedAt: updatedService.updated_at
      };
      
      return sendSuccess(c, { 
        service: responseService, 
        autoSynced 
      }, autoSynced ? 'Service updated and synced!' : 'Service updated successfully');
    } catch (error) {
      console.error('Error updating service:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * DELETE /make-server-3dd53475/vendor/services/:serviceId
   * Delete/Archive a service with cascade delete
   * ✅ GAP #14 FIX: Now uses cascade delete to remove staff assignments
   */
  app.delete("/make-server-3dd53475/vendor/services/:serviceId", async (c) => {
    try {
      const { serviceId } = c.req.param();
      const vendorId = c.req.query('vendorId');
      const force = c.req.query('force') === 'true';
      const cancelBookings = c.req.query('cancelBookings') === 'true';
      
      if (!vendorId) {
        return sendError(c, 'vendorId is required', 400);
      }

      console.log(`\n🗑️ [SERVICE-DELETE] Request to delete service: ${serviceId}`);
      console.log(`   Vendor ID: ${vendorId}`);
      console.log(`   Force: ${force}`);
      console.log(`   Cancel Bookings: ${cancelBookings}`);

      // ✅ SQL: Get vendor UUID
      const vendorRecord = await supabase
        .from('vendors')
        .select('id')
        .eq('vendor_id', vendorId)
        .single();
      
      if (!vendorRecord?.data) {
        return sendError(c, 'Vendor not found', 404);
      }

      const vendorUuid = vendorRecord.data.id;

      // ✅ SQL: Check if service exists
      const { data: existingService, error: fetchError } = await supabase
        .from('vendor_services')
        .select('*')
        .eq('id', serviceId)
        .eq('vendor_id', vendorUuid)
        .single();
      
      if (fetchError || !existingService) {
        return sendError(c, 'Service not found', 404);
      }

      // ✅ SQL: Check for active bookings
      const bookingsRepo = getBookingsRepository();
      const pendingBookings = await bookingsRepo.findByVendor(vendorUuid, { status: 'pending' });
      const confirmedBookings = await bookingsRepo.findByVendor(vendorUuid, { status: 'confirmed' });
      const activeBookings = [...pendingBookings, ...confirmedBookings];
      
      const serviceBookings = activeBookings.filter((b: any) => 
        b.service_id === existingService.service_id
      );

      console.log(`   Active bookings found: ${serviceBookings.length}`);

      if (serviceBookings.length > 0 && !force && !cancelBookings) {
        return sendError(c, {
          message: 'Cannot delete service with active bookings',
          activeBookings: serviceBookings.length,
          suggestion: 'Use force=true to delete anyway, or cancelBookings=true to cancel active bookings'
        }, 400);
      }

      const deleted: string[] = [];
      const cancelled: string[] = [];
      const errors: string[] = [];

      // ✅ SQL: Cancel bookings if requested
      if (cancelBookings && serviceBookings.length > 0) {
        console.log(`   🔄 Cancelling ${serviceBookings.length} active bookings...`);
        
        for (const booking of serviceBookings) {
          try {
            await bookingsRepo.update(booking.id, {
              status: 'cancelled',
              cancellation_reason: 'Service discontinued by vendor'
            });
            cancelled.push(booking.id);
          } catch (error: any) {
            errors.push(`Failed to cancel booking ${booking.id}: ${error.message}`);
          }
        }
      }

      // ✅ SQL: Delete from staff_services (cascade)
      const { error: staffServicesError } = await supabase
        .from('staff_services')
        .delete()
        .eq('service_id', existingService.service_id)
        .eq('vendor_id', vendorUuid);
      
      if (staffServicesError) {
        console.error('Error deleting staff services:', staffServicesError);
        errors.push(`Failed to delete staff services: ${staffServicesError.message}`);
      } else {
        deleted.push('staff_services');
      }

      // ✅ SQL: Delete vendor service
      const { error: deleteError } = await supabase
        .from('vendor_services')
        .delete()
        .eq('id', serviceId)
        .eq('vendor_id', vendorUuid);
      
      if (deleteError) {
        console.error('Error deleting vendor service:', deleteError);
        return sendError(c, {
          message: 'Service deletion failed',
          error: deleteError.message,
          errors
        }, 500);
      }

      deleted.push(serviceId);
      console.log(`✅ [SERVICE-DELETE] Service deleted successfully`);

      return sendSuccess(c, {
        deleted,
        cancelled,
        summary: {
          recordsDeleted: deleted.length,
          bookingsCancelled: cancelled.length
        }
      }, 'Service deleted successfully with cascade cleanup');

    } catch (error) {
      console.error('❌ [SERVICE-DELETE] Error:', error);
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
      
      // ✅ SQL: Get Categories from service_categories table
      const { data: categoriesData } = await supabase
        .from('service_categories')
        .select('*')
        .order('display_order');
      
      const categories = (categoriesData || []).map((cat: any) => ({
        id: cat.id,
        name: cat.name,
        description: cat.description,
        parentCategoryId: cat.parent_category_id,
        displayOrder: cat.display_order
      }));
      
      // ✅ SQL: Get Services from services table (master catalog)
      // For now, we'll use services table. If platform:service_catalog is needed,
      // we should create a service_catalog table
      const { data: allMasterServicesData } = await supabase
        .from('services')
        .select('*')
        .is('vendor_id', null) // Master catalog services have no vendor_id
        .eq('is_active', true);
      
      const allMasterServices = (allMasterServicesData || []).map((s: any) => ({
        id: s.id,
        serviceId: s.id,
        serviceName: s.name,
        name: s.name,
        description: s.description,
        category: s.category,
        categoryId: s.category,
        price: parseFloat(s.price || '0'),
        duration: s.duration_minutes || 30,
        status: 'active',
        isActive: s.is_active
      }));
      
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