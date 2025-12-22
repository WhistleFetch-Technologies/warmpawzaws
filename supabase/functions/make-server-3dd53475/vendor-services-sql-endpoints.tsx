import { Hono } from "npm:hono";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import { sendSuccess, sendError } from "./response-utils.ts";

/**
 * SQL-Based Vendor Service Management Endpoints
 * Replaces KV store with proper SQL database
 */

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export function registerVendorServicesSQLEndpoints(app: Hono) {
  
  /**
   * POST /make-server-3dd53475/vendor/services/publish
   * Publish a service (SQL-based)
   */
  app.post("/make-server-3dd53475/vendor/services/publish", async (c) => {
    try {
      const {
        vendorId,
        serviceName,
        description,
        category,
        subcategory,
        price,
        duration,
        serviceStyle,
        gpsTracking,
        publishLevel,
        centreId,
        centreLevelPrice,
        isCustomService = false,
        isPackage = false
      } = await c.req.json();

      if (!vendorId || !serviceName || !price || !serviceStyle) {
        return sendError(c, 'Missing required fields', 400);
      }

      // Get vendor from SQL - handle both UUID and vendor_id string
      let vendor;
      let vendorError;
      
      // Try UUID first
      if (vendorId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        const result = await supabase
          .from('vendors')
          .select('id, role_id, vendor_id')
          .eq('id', vendorId)
          .single();
        vendor = result.data;
        vendorError = result.error;
      } else {
        // Try vendor_id string
        const result = await supabase
          .from('vendors')
          .select('id, role_id, vendor_id')
          .eq('vendor_id', vendorId)
          .single();
        vendor = result.data;
        vendorError = result.error;
      }

      if (vendorError || !vendor) {
        console.error('Vendor lookup error:', vendorError);
        return sendError(c, 'Vendor not found', 404);
      }

      // Determine if approval is required
      // Custom services and packages require approval, standard services auto-publish
      const requiresApproval = isCustomService || isPackage;
      const publishStatus = requiresApproval ? 'pending_approval' : 'published';
      const isLive = !requiresApproval; // Auto-publish standard services

      // Create service in SQL
      const serviceId = `svc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const { data: newService, error: serviceError } = await supabase
        .from('services')
        .insert({
          service_id: serviceId,
          vendor_id: vendor.id,
          name: serviceName,
          description: description || '',
          category: category || '',
          base_price: parseFloat(price),
          duration_minutes: parseInt(duration) || 30,
          service_style: serviceStyle,
          service_styles: [serviceStyle],
          is_custom_service: isCustomService,
          is_package: isPackage,
          publish_status: publishStatus,
          is_live: isLive,
          requires_approval: requiresApproval,
          // center_id: null, // TODO: Add centers table if needed
          published_at: isLive ? new Date().toISOString() : null,
          metadata: {
            gpsTracking: gpsTracking || false,
            subcategory: subcategory || null,
            publishLevel: publishLevel || 'vendor',
            centreLevelPrice: centreLevelPrice || null
          }
        })
        .select()
        .single();

      if (serviceError) {
        console.error('Error creating service:', serviceError);
        return sendError(c, `Failed to create service: ${serviceError.message}`, 500);
      }

      // Create vendor_service configuration
      const { data: vendorService, error: vendorServiceError } = await supabase
        .from('vendor_services')
        .insert({
          vendor_id: vendor.id,
          service_id: newService.id,
          service_style: serviceStyle,
          is_enabled: true,
          custom_price: centreLevelPrice ? parseFloat(centreLevelPrice) : null,
          custom_duration: parseInt(duration) || null,
          custom_description: description || null,
          is_published: isLive,
          publish_status: publishStatus,
          requires_approval: requiresApproval
        })
        .select()
        .single();

      if (vendorServiceError) {
        console.error('Error creating vendor service:', vendorServiceError);
        // Continue even if vendor_service creation fails
      }

      return sendSuccess(c, {
        success: true,
        service: newService,
        vendorService: vendorService,
        message: isLive 
          ? 'Service published and live!' 
          : 'Service submitted for approval',
        requiresApproval,
        isLive
      });

    } catch (error) {
      console.error('Error in publish service:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /make-server-3dd53475/vendor/services/:vendorId
   * Get all services for a vendor (SQL-based)
   */
  app.get("/make-server-3dd53475/vendor/services/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();

      // Get vendor from SQL - handle both UUID and vendor_id string
      let vendor;
      let vendorError;
      
      if (vendorId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        const result = await supabase
          .from('vendors')
          .select('id')
          .eq('id', vendorId)
          .single();
        vendor = result.data;
        vendorError = result.error;
      } else {
        const result = await supabase
          .from('vendors')
          .select('id')
          .eq('vendor_id', vendorId)
          .single();
        vendor = result.data;
        vendorError = result.error;
      }

      if (vendorError || !vendor) {
        return sendError(c, 'Vendor not found', 404);
      }

      // Get all services for this vendor
      const { data: services, error: servicesError } = await supabase
        .from('services')
        .select(`
          *,
          vendor_services (*)
        `)
        .eq('vendor_id', vendor.id)
        .order('created_at', { ascending: false });

      if (servicesError) {
        console.error('Error fetching services:', servicesError);
        return sendError(c, 'Failed to fetch services', 500);
      }

      // Group by service style
      const servicesByStyle: any = {
        at_center: { services: [], count: 0 },
        at_home: { services: [], count: 0 },
        tele: { services: [], count: 0 }
      };

      const allServices = (services || []).map((service: any) => {
        const style = service.service_style || 'at_center';
        const vendorService = service.vendor_services?.[0];
        
        return {
          ...service,
          isLive: service.is_live,
          publishStatus: service.publish_status,
          requiresApproval: service.requires_approval,
          customPrice: vendorService?.custom_price || service.base_price,
          customDuration: vendorService?.custom_duration || service.duration_minutes,
          isEnabled: vendorService?.is_enabled !== false
        };
      });

      // Group services by style
      allServices.forEach((service: any) => {
        const style = service.service_style || 'at_center';
        if (servicesByStyle[style]) {
          servicesByStyle[style].services.push(service);
          servicesByStyle[style].count++;
        }
      });

      return sendSuccess(c, {
        success: true,
        services: servicesByStyle,
        allServices: allServices,
        vendorId,
        totalServices: allServices.length,
        totalLive: allServices.filter((s: any) => s.isLive).length
      });

    } catch (error) {
      console.error('Error fetching vendor services:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * PUT /make-server-3dd53475/vendor/services/:serviceId
   * Update a service (SQL-based)
   */
  app.put("/make-server-3dd53475/vendor/services/:serviceId", async (c) => {
    try {
      const { serviceId } = c.req.param();
      const updateData = await c.req.json();

      // Update service in SQL
      const { data: updatedService, error: updateError } = await supabase
        .from('services')
        .update({
          name: updateData.name,
          description: updateData.description,
          base_price: updateData.price,
          duration_minutes: updateData.duration,
          updated_at: new Date().toISOString()
        })
        .eq('service_id', serviceId)
        .select()
        .single();

      if (updateError) {
        return sendError(c, `Failed to update service: ${updateError.message}`, 500);
      }

      return sendSuccess(c, {
        success: true,
        service: updatedService,
        message: 'Service updated successfully'
      });

    } catch (error) {
      console.error('Error updating service:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/vendor/services/:serviceId/toggle-live
   * Toggle service live status (SQL-based)
   */
  app.post("/make-server-3dd53475/vendor/services/:serviceId/toggle-live", async (c) => {
    try {
      const { serviceId } = c.req.param();

      // Get current service
      const { data: service, error: fetchError } = await supabase
        .from('services')
        .select('is_live, publish_status')
        .eq('service_id', serviceId)
        .single();

      if (fetchError || !service) {
        return sendError(c, 'Service not found', 404);
      }

      // Only allow toggling if service is published
      if (service.publish_status !== 'published') {
        return sendError(c, 'Service must be published before going live', 400);
      }

      const newLiveStatus = !service.is_live;

      // Update service
      const { data: updatedService, error: updateError } = await supabase
        .from('services')
        .update({
          is_live: newLiveStatus,
          published_at: newLiveStatus ? new Date().toISOString() : service.published_at,
          updated_at: new Date().toISOString()
        })
        .eq('service_id', serviceId)
        .select()
        .single();

      if (updateError) {
        return sendError(c, `Failed to update service: ${updateError.message}`, 500);
      }

      // Also update vendor_services
      await supabase
        .from('vendor_services')
        .update({
          is_published: newLiveStatus,
          updated_at: new Date().toISOString()
        })
        .eq('service_id', updatedService.id);

      return sendSuccess(c, {
        success: true,
        service: updatedService,
        isLive: newLiveStatus,
        message: newLiveStatus ? 'Service is now live!' : 'Service is now offline'
      });

    } catch (error) {
      console.error('Error toggling service live status:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /make-server-3dd53475/staff/:staffId/available-services
   * Get center services available for staff to enable (SQL-based)
   */
  app.get("/make-server-3dd53475/staff/:staffId/available-services", async (c) => {
    try {
      const { staffId } = c.req.param();

      // Get staff and their vendor
      const { data: staff, error: staffError } = await supabase
        .from('staff')
        .select('id, vendor_id, center_id')
        .eq('staff_id', staffId)
        .single();

      if (staffError || !staff) {
        return sendError(c, 'Staff not found', 404);
      }

      // Get vendor's center services (excluding custom services and packages)
      const { data: centerServices, error: servicesError } = await supabase
        .from('services')
        .select(`
          *,
          vendor_services!inner (*)
        `)
        .eq('vendor_id', staff.vendor_id)
        .eq('is_custom_service', false)
        .eq('is_package', false)
        .eq('is_live', true)
        .eq('publish_status', 'published')
        .not('center_id', 'is', null);

      if (servicesError) {
        console.error('Error fetching center services:', servicesError);
        return sendError(c, 'Failed to fetch center services', 500);
      }

      // Get staff's currently enabled services
      const { data: staffServices, error: staffServicesError } = await supabase
        .from('staff_services')
        .select('service_id, vendor_service_id, is_enabled')
        .eq('staff_id', staff.id);

      const enabledServiceIds = new Set(
        (staffServices || [])
          .filter((ss: any) => ss.is_enabled)
          .map((ss: any) => ss.service_id)
      );

      // Mark which services are enabled for this staff
      const availableServices = (centerServices || []).map((service: any) => ({
        ...service,
        isEnabled: enabledServiceIds.has(service.id),
        canEnable: true // Center services can always be enabled by staff
      }));

      return sendSuccess(c, {
        success: true,
        services: availableServices,
        staffId,
        totalAvailable: availableServices.length,
        totalEnabled: availableServices.filter((s: any) => s.isEnabled).length
      });

    } catch (error) {
      console.error('Error fetching staff available services:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/staff/:staffId/services/:serviceId/enable
   * Enable a center service for staff (SQL-based)
   */
  app.post("/make-server-3dd53475/staff/:staffId/services/:serviceId/enable", async (c) => {
    try {
      const { staffId, serviceId } = c.req.param();
      const { enabled = true } = await c.req.json();

      // Get staff
      const { data: staff, error: staffError } = await supabase
        .from('staff')
        .select('id')
        .eq('staff_id', staffId)
        .single();

      if (staffError || !staff) {
        return sendError(c, 'Staff not found', 404);
      }

      // Get service
      const { data: service, error: serviceError } = await supabase
        .from('services')
        .select('id, is_custom_service, is_package')
        .eq('service_id', serviceId)
        .single();

      if (serviceError || !service) {
        return sendError(c, 'Service not found', 404);
      }

      // Don't allow enabling custom services or packages
      if (service.is_custom_service || service.is_package) {
        return sendError(c, 'Custom services and packages cannot be enabled by staff', 400);
      }

      // Upsert staff service
      const { data: staffService, error: upsertError } = await supabase
        .from('staff_services')
        .upsert({
          staff_id: staff.id,
          service_id: service.id,
          is_enabled: enabled,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'staff_id,service_id'
        })
        .select()
        .single();

      if (upsertError) {
        return sendError(c, `Failed to ${enabled ? 'enable' : 'disable'} service: ${upsertError.message}`, 500);
      }

      return sendSuccess(c, {
        success: true,
        staffService,
        message: `Service ${enabled ? 'enabled' : 'disabled'} successfully`
      });

    } catch (error) {
      console.error('Error enabling staff service:', error);
      return sendError(c, error, 500);
    }
  });
}

