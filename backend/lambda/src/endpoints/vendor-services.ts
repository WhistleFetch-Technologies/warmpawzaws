/**
 * ============================================================================
 * VENDOR SERVICES MANAGEMENT ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Handles vendor service management:
 * - Get vendor services (by style)
 * - Add/update/delete services
 * - Enable/disable services
 * - Custom service creation
 * 
 * Migrated from: supabase/functions/make-server-vendor/vendor-services-endpoints.tsx
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import { select, insert, update, query } from '../database/rds-connection';
import { checkVendorCapability } from '../middleware/capability-enforcement';
import { extractEntityIds, normalizeDbRow, buildVendorResponse } from '../utils/entity-extractor';
import { isValidUUID, normalizeVendorService } from '../types/entities';

export function registerVendorServicesEndpoints(app: Hono) {
  /**
   * GET /vendor/:vendorId/services
   * Get all services for a vendor (grouped by style)
   * ✅ CRITICAL: Includes role, capabilities, and allowed service styles (DB query - no frontend dependency)
   */
  app.get("/vendor/:vendorId/services", async (c) => {
    try {
      const { vendorId } = c.req.param();

      // Handle test IDs - return empty services
      if (vendorId === 'test-vendor-id' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(vendorId)) {
        return c.json({
          success: true,
          services: [],
          total: 0,
        });
      }

      // ✅ CRITICAL: Get vendor with role and capabilities from DB (no frontend dependency)
      const vendors = await select('vendors', { id: vendorId });
      if (vendors.length === 0) {
        // Return empty services gracefully for approved vendors without vendors table entry
        console.log(`[Vendor Services] Vendor ${vendorId} not found in vendors table, returning empty services`);
        return c.json({
          success: true,
          services: [],
          servicesByStyle: {
            at_home: { services: [], count: 0 },
            at_center: { services: [], count: 0 },
            tele: { services: [], count: 0 },
          },
          total: 0,
          role: null,
          capabilities: [],
          allowedServiceStyles: ['at_home', 'at_center', 'tele'],
        });
      }
      const vendor = vendors[0];

      let role = null;
      let capabilities: string[] = [];
      let roleConfig: any = {};
      let allowedServiceStyles: string[] = ['at_home', 'at_center', 'tele'];

      if (vendor.role_id) {
        try {
          const roles = await select('roles', { id: vendor.role_id });
          if (roles.length > 0) {
            role = roles[0];
            roleConfig = role.config || {};
            const rawStyles = roleConfig?.serviceStyles || roleConfig?.service_styles || ['at_home', 'at_center', 'tele'];
            
            // Map role config styles to database styles
            // Role config uses: at_clinic, video_consultation, home_visit
            // Database uses: at_center, at_home, tele
            const styleMapping: Record<string, string> = {
              'at_clinic': 'at_center',
              'at_center': 'at_center',
              'video_consultation': 'tele',
              'tele': 'tele',
              'home_visit': 'at_home',
              'at_home': 'at_home',
            };
            allowedServiceStyles = rawStyles.map((s: string) => styleMapping[s] || s);
            
            // Get capabilities from DB
            try {
              const allPermissions = await query(
                `SELECT role_id, permission_name 
                 FROM role_permissions 
                 WHERE role_id = ANY($1::text[])`,
                [[vendor.role_id]]
              );
              capabilities = allPermissions.rows.map((p: any) => p.permission_name);
            } catch {
              const permissions = await select('role_permissions', { role_id: vendor.role_id });
              capabilities = permissions.map(p => p.permission_name);
            }
          }
        } catch (roleError: any) {
          console.warn(`[Vendor Services] Failed to load role ${vendor.role_id}:`, roleError.message);
          // Continue with default service styles
        }
      }

      const serviceStyles = ['at_home', 'at_center', 'tele'];
      const servicesByStyle: Record<string, any> = {};

      for (const style of serviceStyles) {
        // Only fetch services for allowed styles
        if (!allowedServiceStyles.includes(style)) {
          servicesByStyle[style] = { services: [], count: 0 };
          continue;
        }

        const services = await query(
          `SELECT vs.*, s.name as base_service_name, s.description as base_description
           FROM vendor_services vs
           LEFT JOIN services s ON vs.service_id = s.id
           WHERE vs.vendor_id = $1
           AND vs.service_style = $2
           AND vs.is_enabled = true
           AND vs.publish_status IN ('published', 'auto_published')
           ORDER BY vs.created_at DESC`,
          [vendorId, style]
        );

        servicesByStyle[style] = {
          services: services.rows.map((s: any) => ({
            id: s.id,
            serviceId: s.service_id,
            serviceName: s.service_name || s.base_service_name,
            name: s.service_name || s.base_service_name,
            description: s.description || s.base_description,
            category: s.category,
            subCategory: s.sub_category,
            price: parseFloat(s.price || s.custom_price || '0'),
            duration: s.duration_minutes || s.custom_duration || 30,
            serviceStyle: s.service_style,
            publishStatus: s.publish_status,
            isEnabled: s.is_enabled,
            isCustomService: s.is_custom_service,
            metadata: s.metadata || {},
          })),
          count: services.rows.length,
        };
      }

      const allServices = Object.values(servicesByStyle).flatMap((style: any) => style.services);

      return c.json({
        success: true,
        services: servicesByStyle,
        allServices,
        totalEnabled: allServices.length,
        // ✅ Include role and capabilities directly (no separate API call needed)
        vendor: {
          id: vendor.id,
          role_id: vendor.role_id,
          vendor_type: vendor.vendor_type,
        },
        role: role ? {
          id: role.id,
          name: role.name,
          display_name: role.display_name,
          config: roleConfig,
        } : null,
        capabilities,
        allowedServiceStyles, // ✅ Included so frontend knows what styles are allowed
        vendorTypes: roleConfig?.vendorTypes || [],
      });
    } catch (error: any) {
      console.error('Error fetching vendor services:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/services/:serviceStyle
   * Get services for a specific style
   */
  app.get("/vendor/:vendorId/services/:serviceStyle", async (c) => {
    try {
      const { vendorId, serviceStyle } = c.req.param();

      if (!['at_home', 'at_center', 'tele'].includes(serviceStyle)) {
        return c.json({ error: 'Invalid service style' }, 400);
      }

      const services = await query(
        `SELECT vs.*, s.name as base_service_name
         FROM vendor_services vs
         LEFT JOIN services s ON vs.service_id = s.id
         WHERE vs.vendor_id = $1
         AND vs.service_style = $2
         AND vs.is_enabled = true
         ORDER BY vs.created_at DESC`,
        [vendorId, serviceStyle]
      );

      return c.json({
        success: true,
        services: services.rows,
        total: services.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching vendor services:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/services
   * Add a service to vendor catalog
   * Requires 'services' capability
   */
  app.post("/vendor/:vendorId/services", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      // Check if vendor has services or custom_services capability
      const hasServicesCapability = await checkVendorCapability(vendorId, 'services') || 
                                     await checkVendorCapability(vendorId, 'custom_services');
      if (!hasServicesCapability) {
        return c.json({ error: 'Vendor does not have services capability' }, 403);
      }
      
      // CRITICAL: Ensure we use the correct vendor ID from vendors table
      // If vendor only exists in vendor_identity (approved), we need to find or create the vendor record
      let actualVendorId = vendorId;
      const existingVendor = await select('vendors', { id: vendorId });
      if (existingVendor.length === 0) {
        console.log(`[VendorServices] Vendor ${vendorId} not found in vendors table, checking vendor_identity...`);
        const identities = await select('vendor_identity', { id: vendorId });
        if (identities.length > 0) {
          const identity = identities[0];
          if (identity.onboarding_status === 'APPROVED' || identity.onboarding_status === 'ACTIVATED') {
            // Check if vendor exists by phone (there might be an existing vendor with different ID)
            const vendorByPhone = await select('vendors', { phone: identity.phone });
            if (vendorByPhone.length > 0) {
              actualVendorId = vendorByPhone[0].id;
              console.log(`[VendorServices] Found existing vendor by phone: ${actualVendorId}`);
            } else {
              // Get application data for vendor details
              const applications = await select('vendor_onboarding_applications', { vendor_identity_id: vendorId });
              const application = applications.length > 0 ? applications[0] : null;
              const payload = application?.application_payload || {};
              
              // Create vendors record
              console.log(`[VendorServices] Auto-creating vendor record for approved vendor ${vendorId}`);
              const newVendor = await insert('vendors', {
                id: vendorId,
                phone: identity.phone,
                email: payload.email || `vendor-${identity.phone}@warmpawz.app`,
                business_name: payload.businessName || payload.business_name || `Vendor ${identity.phone}`,
                owner_name: payload.contactPersonName || payload.ownerName || 'Vendor Owner',
                role_id: identity.selected_role_id,
                category: 'general',
                address: payload.address || 'Not specified',
                city: payload.city || 'Not specified',
                state: payload.state || 'Not specified',
                pincode: payload.pin || payload.pincode || '000000',
                status: 'active',
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });
              console.log(`[VendorServices] Created vendor record for ${vendorId}`);
            }
          } else {
            return c.json({ error: 'Vendor not approved or activated' }, 403);
          }
        } else {
          return c.json({ error: 'Vendor identity not found' }, 404);
        }
      }
      
      const serviceData = await c.req.json();
      const {
        serviceId,
        catalogId, // Also accept catalogId from service_catalog
        serviceStyle,
        serviceName, // Accept service name for catalog items
        categoryName, // Accept category name for catalog items
        customPrice,
        customDuration,
        basePrice,
        duration,
        isEnabled,
        publishStatus,
        isCustomService,
        description,
      } = serviceData;

      // Support both serviceId and catalogId
      const inputServiceId = serviceId || catalogId;
      
      if (!inputServiceId || !serviceStyle) {
        return c.json({ error: 'serviceId and serviceStyle are required' }, 400);
      }

      // ✅ FIX: Determine if inputServiceId is UUID or TEXT catalog ID
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(inputServiceId);
      console.log(`[VendorServices] Input service ID: ${inputServiceId}, isUUID: ${isUUID}`);
      
      let effectiveServiceId: string = inputServiceId;
      let baseService: any = null;
      
      if (isUUID) {
        // Try to get service from services table by UUID
        const baseServices = await select('services', { id: inputServiceId });
        if (baseServices.length > 0) {
          baseService = baseServices[0];
          effectiveServiceId = baseServices[0].id;
        } else {
          // Try service_catalog by UUID id
          const catalogResult = await query(
            `SELECT * FROM service_catalog WHERE id::text = $1`,
            [inputServiceId]
          );
          if (catalogResult.rows.length > 0) {
            const catalogItem = catalogResult.rows[0];
            baseService = {
              name: catalogItem.service_name || catalogItem.display_name || serviceName,
              category: catalogItem.category_name || categoryName,
              price: catalogItem.base_price || basePrice || 0,
              duration_minutes: catalogItem.duration_minutes || duration || 30,
              catalogId: catalogItem.service_id, // TEXT catalog ID
            };
            effectiveServiceId = catalogItem.id; // UUID from service_catalog
          }
        }
      } else {
        // Input is TEXT catalog ID (like "general-checkup")
        // Query service_catalog by TEXT service_id
        const catalogResult = await query(
          `SELECT * FROM service_catalog WHERE service_id = $1`,
          [inputServiceId]
        );
        
        if (catalogResult.rows.length > 0) {
          const catalogItem = catalogResult.rows[0];
          baseService = {
            name: catalogItem.service_name || catalogItem.display_name || serviceName,
            category: catalogItem.category_name || categoryName,
            price: catalogItem.base_price || basePrice || 0,
            duration_minutes: catalogItem.duration_minutes || duration || 30,
            catalogId: catalogItem.service_id,
          };
          // Use the UUID 'id' column from service_catalog for vendor_services
          effectiveServiceId = catalogItem.id;
          console.log(`[VendorServices] Resolved TEXT catalog ID ${inputServiceId} to UUID ${effectiveServiceId}`);
        }
      }
      
      // If still no base service, try with provided data (custom services)
      if (!baseService && serviceName) {
        baseService = {
          name: serviceName,
          category: categoryName || 'General',
          price: basePrice || 0,
          duration_minutes: duration || 30,
        };
        // Generate a new UUID for custom service
        effectiveServiceId = randomUUID();
        console.log(`[VendorServices] Creating custom service with new UUID: ${effectiveServiceId}`);
      }
      
      if (!baseService) {
        return c.json({ error: 'Base service not found' }, 404);
      }

      // Check if service already exists (using actualVendorId after vendor resolution above)
      const existing = await query(
        `SELECT id, publish_status, is_enabled FROM vendor_services
         WHERE vendor_id = $1 AND service_id = $2 AND service_style = $3`,
        [actualVendorId, effectiveServiceId, serviceStyle]
      );

      if (existing.rows.length > 0) {
        // ✅ FIX: Return the existing service instead of error
        // This allows frontend to gracefully handle already-added services
        return c.json({ 
          success: true,
          message: 'Service already exists',
          alreadyExists: true,
          vendorServiceId: existing.rows[0].id,
          publishStatus: existing.rows[0].publish_status,
          isEnabled: existing.rows[0].is_enabled
        }, 200);
      }

      const vendorService = await insert('vendor_services', {
        vendor_id: actualVendorId,
        service_id: effectiveServiceId, // Now always UUID
        service_name: baseService.name,
        category: baseService.category,
        service_style: serviceStyle,
        price: customPrice || baseService.price || 0,
        custom_price: customPrice || null,
        duration_minutes: customDuration || baseService.duration_minutes || 30,
        custom_duration: customDuration || null,
        is_enabled: isEnabled !== false,
        publish_status: publishStatus || 'published',
        is_custom_service: isCustomService || false,
        custom_description: description || null,
      });

      return c.json({
        success: true,
        service: vendorService[0],
        vendorServiceId: vendorService[0]?.id,
        message: 'Service added successfully',
      });
    } catch (error: any) {
      console.error('Error adding vendor service:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /vendor/:vendorId/services/:serviceId
   * Update vendor service
   * Requires 'services' capability
   */
  app.put("/vendor/:vendorId/services/:serviceId", async (c) => {
    try {
      const { vendorId, serviceId } = c.req.param();
      
      // Check if vendor has services or custom_services capability
      const hasServicesCapability = await checkVendorCapability(vendorId, 'services') || 
                                     await checkVendorCapability(vendorId, 'custom_services');
      if (!hasServicesCapability) {
        return c.json({ error: 'Vendor does not have services capability' }, 403);
      }
      
      const serviceData = await c.req.json();

      const updated = await update('vendor_services',
        { id: serviceId, vendor_id: vendorId },
        {
          price: serviceData.price || serviceData.customPrice,
          custom_price: serviceData.customPrice,
          duration_minutes: serviceData.duration || serviceData.customDuration,
          custom_duration: serviceData.customDuration,
          is_enabled: serviceData.isEnabled,
          publish_status: serviceData.publishStatus,
        }
      );

      if (updated.length === 0) {
        return c.json({ error: 'Service not found' }, 404);
      }

      return c.json({
        success: true,
        service: updated[0],
        message: 'Service updated successfully',
      });
    } catch (error: any) {
      console.error('Error updating vendor service:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * DELETE /vendor/:vendorId/services/:serviceId
   * Remove service from vendor catalog
   * Requires 'services' capability
   */
  app.delete("/vendor/:vendorId/services/:serviceId", async (c) => {
    try {
      const { vendorId, serviceId } = c.req.param();
      
      // Check if vendor has services or custom_services capability
      const hasServicesCapability = await checkVendorCapability(vendorId, 'services') || 
                                     await checkVendorCapability(vendorId, 'custom_services');
      if (!hasServicesCapability) {
        return c.json({ error: 'Vendor does not have services capability' }, 403);
      }

      await query(
        'DELETE FROM vendor_services WHERE id = $1 AND vendor_id = $2',
        [serviceId, vendorId]
      );

      return c.json({
        success: true,
        message: 'Service removed successfully',
      });
    } catch (error: any) {
      console.error('Error removing vendor service:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/services/custom
   * Create custom service
   * Requires 'services' capability
   */
  app.post("/vendor/:vendorId/services/custom", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      // Check if vendor has services or custom_services capability
      const hasServicesCapability = await checkVendorCapability(vendorId, 'services') || 
                                     await checkVendorCapability(vendorId, 'custom_services');
      if (!hasServicesCapability) {
        return c.json({ error: 'Vendor does not have services capability' }, 403);
      }
      
      const serviceData = await c.req.json();
      const {
        serviceName,
        description,
        category,
        subCategory,
        serviceStyle,
        price,
        duration,
      } = serviceData;

      if (!serviceName || !serviceStyle || !price) {
        return c.json({ error: 'serviceName, serviceStyle, and price are required' }, 400);
      }

      // Create base service first
      // Note: services table requires price column (not null constraint)
      const baseService = await insert('services', {
        name: serviceName,
        description: description || null,
        category: category || null,
        price: price, // Required column
        duration_minutes: duration || 30,
        is_active: true,
        // Don't include: service_style, is_global (stored in vendor_services)
      });

      // Create vendor service link
      const vendorService = await insert('vendor_services', {
        vendor_id: vendorId,
        service_id: baseService[0].id,
        service_name: serviceName,
        category: category || null,
        sub_category: subCategory || null,
        service_style: serviceStyle,
        price: price,
        custom_price: price,
        duration_minutes: duration || 30,
        custom_duration: duration || 30,
        is_enabled: true,
        publish_status: 'published',
        is_custom_service: true,
      });

      return c.json({
        success: true,
        service: vendorService[0],
        message: 'Custom service created successfully',
      });
    } catch (error: any) {
      console.error('Error creating custom service:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}

