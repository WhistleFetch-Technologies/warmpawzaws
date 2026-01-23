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
      const customOnly = c.req.query('custom') === 'true'; // ✅ Support custom=true filter

      // Handle test IDs - return empty services
      if (vendorId === 'test-vendor-id' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(vendorId)) {
        return c.json({
          success: true,
          services: [],
          total: 0,
        });
      }

      // ✅ If custom=true, return only custom services (different response format)
      if (customOnly) {
        const customServices = await query(
          `SELECT vs.*, s.name as base_service_name, s.description as base_description
           FROM vendor_services vs
           LEFT JOIN services s ON vs.service_id = s.id
           WHERE vs.vendor_id = $1
           AND vs.is_custom_service = true
           ORDER BY vs.created_at DESC`,
          [vendorId]
        );

        const formattedServices = customServices.rows.map((s: any) => ({
          id: s.id,
          serviceId: s.service_id,
          serviceName: s.service_name || s.base_service_name,
          name: s.service_name || s.base_service_name,
          description: s.custom_description || s.description || s.base_description,
          categoryName: s.category,
          subCategoryName: s.sub_category,
          price: parseFloat(s.price || s.custom_price || '0'),
          duration: s.duration_minutes || s.custom_duration || 30,
          serviceStyle: s.service_style,
          publishStatus: s.publish_status,
          isEnabled: s.is_enabled,
          isCustomService: true,
          isPackage: s.metadata?.isPackage || false,
          packageDetails: s.metadata?.packageDetails,
          submittedForApprovalAt: s.submitted_for_approval_at,
          rejectionReason: s.rejection_reason,
          createdAt: s.created_at,
          updatedAt: s.updated_at,
        }));

        return c.json({
          success: true,
          services: formattedServices,
          total: formattedServices.length,
        });
      }

      // ✅ CRITICAL: Get vendor with role and capabilities from DB (no frontend dependency)
      let vendors: any[] = [];
      try {
        vendors = await select('vendors', { id: vendorId });
      } catch (selectError: any) {
        // Handle table not existing or other DB errors gracefully
        console.error(`[Vendor Services] DB error looking up vendor ${vendorId}:`, selectError.message);
        if (selectError.message?.includes('does not exist') || selectError.message?.includes('relation')) {
          // Table doesn't exist - return empty services
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
            _note: 'Database not fully configured',
          });
        }
        // For other errors, return a graceful empty response instead of 500
        return c.json({
          success: false,
          error: 'Failed to load vendor data',
          services: [],
          total: 0,
        }, 500);
      }
      
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
            
            // ✅ CRITICAL FIX: Solo providers cannot use at_center - filter it out from allowedServiceStyles
            const vendorConfiguration = roleConfig?.vendorConfiguration || roleConfig?.vendor_configuration;
            if (vendorConfiguration === 'solo') {
              allowedServiceStyles = allowedServiceStyles.filter(style => style !== 'at_center');
              console.log(`[Vendor Services] Solo provider detected - filtered out at_center. Allowed styles: ${allowedServiceStyles.join(', ')}`);
            }
            
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
      
      // ✅ CRITICAL FIX: Also check vendor table for solo configuration as fallback
      if (vendor.vendor_configuration === 'solo' || vendor.vendorConfiguration === 'solo') {
        allowedServiceStyles = allowedServiceStyles.filter(style => style !== 'at_center');
        console.log(`[Vendor Services] Solo provider detected from vendor table - filtered out at_center. Allowed styles: ${allowedServiceStyles.join(', ')}`);
      }

      const serviceStyles = ['at_home', 'at_center', 'tele'];
      const servicesByStyle: Record<string, any> = {};

      // ✅ FIX: Batch all service queries into a single query to reduce connection usage
      // Instead of 3 separate queries (one per style), use one query with ANY()
      if (allowedServiceStyles.length > 0) {
        // Single query to get all services for all allowed styles at once
        const allServices = await query(
          `SELECT vs.*, s.name as base_service_name, s.description as base_description
           FROM vendor_services vs
           LEFT JOIN services s ON vs.service_id = s.id
           WHERE vs.vendor_id = $1
           AND vs.service_style = ANY($2::text[])
           ORDER BY vs.service_style, vs.created_at DESC`,
          [vendorId, allowedServiceStyles]
        );

        // Group services by style
        for (const style of serviceStyles) {
          if (!allowedServiceStyles.includes(style)) {
            servicesByStyle[style] = { services: [], count: 0 };
            continue;
          }
          
          const styleServices = allServices.rows.filter((s: any) => s.service_style === style);
          servicesByStyle[style] = {
            services: styleServices.map((s: any) => ({
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
              isCustomService: s.is_custom_service || false,
              metadata: s.metadata || {},
              createdAt: s.created_at,
              updatedAt: s.updated_at,
            })),
            count: styleServices.length,
          };
        }
      } else {
        // No allowed styles, return empty
        for (const style of serviceStyles) {
          servicesByStyle[style] = { services: [], count: 0 };
        }
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
   * ✅ FIX: Validate service style against vendor's allowed styles (solo providers can't use at_center)
   */
  app.get("/vendor/:vendorId/services/:serviceStyle", async (c) => {
    try {
      const { vendorId, serviceStyle } = c.req.param();

      if (!['at_home', 'at_center', 'tele'].includes(serviceStyle)) {
        return c.json({ error: 'Invalid service style' }, 400);
      }

      // ✅ FIX: Check vendor's role config to validate allowed service styles
      let vendors: any[] = [];
      try {
        vendors = await select('vendors', { id: vendorId });
      } catch (selectError: any) {
        console.error(`[Vendor Services] DB error looking up vendor ${vendorId}:`, selectError.message);
        return c.json({ 
          success: false,
          error: 'Failed to load vendor data',
          services: [],
          total: 0,
        }, 500);
      }

      if (vendors.length === 0) {
        return c.json({
          success: true,
          services: [],
          total: 0,
        });
      }

      const vendor = vendors[0];
      let allowedServiceStyles: string[] = ['at_home', 'at_center', 'tele'];

      // Get role config to check allowed service styles
      if (vendor.role_id) {
        try {
          const roles = await select('roles', { id: vendor.role_id });
          if (roles.length > 0) {
            const role = roles[0];
            const roleConfig = role.config || {};
            const vendorConfiguration = roleConfig?.vendorConfiguration || roleConfig?.vendor_configuration;
            
            // ✅ CRITICAL: Solo providers cannot use at_center
            if (vendorConfiguration === 'solo' && serviceStyle === 'at_center') {
              return c.json({
                success: false,
                error: 'Solo providers cannot use "at_center" service style. Only "at_home" and "tele" are allowed.',
                services: [],
                total: 0,
              }, 400);
            }

            const rawStyles = roleConfig?.serviceStyles || roleConfig?.service_styles || ['at_home', 'at_center', 'tele'];
            
            // Map role config styles to database styles
            const styleMapping: Record<string, string> = {
              'at_clinic': 'at_center',
              'at_center': 'at_center',
              'video_consultation': 'tele',
              'tele': 'tele',
              'home_visit': 'at_home',
              'at_home': 'at_home',
            };
            allowedServiceStyles = rawStyles.map((s: string) => styleMapping[s] || s);
          }
        } catch (roleError: any) {
          console.warn(`[Vendor Services] Failed to load role ${vendor.role_id}:`, roleError.message);
        }
      }

      // ✅ Validate that the requested service style is allowed
      if (!allowedServiceStyles.includes(serviceStyle)) {
        return c.json({
          success: false,
          error: `Service style "${serviceStyle}" is not allowed for this vendor. Allowed styles: ${allowedServiceStyles.join(', ')}`,
          services: [],
          total: 0,
        }, 400);
      }

      // ✅ FIX: Return ALL services (enabled and disabled) for management
      // Remove is_enabled filter so vendors can see and manage all their services
      // Note: serviceStyle is already validated above, so all returned services will match allowed styles
      const services = await query(
        `SELECT vs.*, s.name as base_service_name, s.description as base_description
         FROM vendor_services vs
         LEFT JOIN services s ON vs.service_id = s.id
         WHERE vs.vendor_id = $1
         AND vs.service_style = $2
         ORDER BY vs.created_at DESC`,
        [vendorId, serviceStyle]
      );

      return c.json({
        success: true,
        services: services.rows,
        total: services.rows.length,
        allowedServiceStyles, // ✅ Include in response so frontend knows what's allowed
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
        // PHASE 1.1: Missing Features
        serviceRadius, // Service radius in km (for at_home)
        queueConfig, // Queue configuration JSON (for tele)
      } = serviceData;

      // Support both serviceId and catalogId
      const inputServiceId = serviceId || catalogId;
      
      if (!inputServiceId || !serviceStyle) {
        return c.json({ error: 'serviceId and serviceStyle are required' }, 400);
      }

      // ✅ PHASE 0.4: Validate serviceStyle against role configuration
      // Get vendor with role to check allowed service styles
      let vendorForValidation: any[] = [];
      if (existingVendor.length > 0) {
        vendorForValidation = existingVendor;
      } else {
        // If vendor was auto-created or resolved, get it again
        const resolvedVendor = await select('vendors', { id: actualVendorId });
        vendorForValidation = resolvedVendor;
      }
      
      if (vendorForValidation.length > 0 && vendorForValidation[0].role_id) {
        try {
          const roles = await select('roles', { id: vendorForValidation[0].role_id });
          if (roles.length > 0) {
            const roleConfig = roles[0].config || {};
            const rawStyles = roleConfig?.serviceStyles || roleConfig?.service_styles || [];
            
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
            const allowedServiceStyles = rawStyles.length > 0 
              ? rawStyles.map((s: string) => styleMapping[s] || s)
              : ['at_home', 'at_center', 'tele']; // Default if no config
            
            // Validate serviceStyle against allowed styles
            if (!allowedServiceStyles.includes(serviceStyle)) {
              return c.json({ 
                error: `Service style '${serviceStyle}' is not allowed for this role. Allowed styles: ${allowedServiceStyles.join(', ')}`,
                allowedStyles: allowedServiceStyles
              }, 403);
            }
            
            console.log(`[VendorServices] ✅ Service style validation passed: ${serviceStyle} is allowed for vendor ${actualVendorId}`);
          }
        } catch (roleError: any) {
          console.warn(`[VendorServices] Failed to validate service style against role config:`, roleError.message);
          // Continue without validation if role config lookup fails (graceful degradation)
        }
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
        // PHASE 1.1: Missing Features
        service_radius_km: serviceRadius || null, // Service radius in km (for at_home)
        queue_config: queueConfig ? JSON.stringify(queueConfig) : null, // Queue config JSON (for tele)
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

      // ✅ FIX: Build update data object, only including defined values
      // Support multiple field name variations from frontend
      const updateData: any = {};
      
      if (serviceData.price !== undefined || serviceData.customPrice !== undefined) {
        updateData.price = serviceData.price || serviceData.customPrice;
      }
      if (serviceData.customPrice !== undefined) {
        updateData.custom_price = serviceData.customPrice;
      }
      if (serviceData.duration !== undefined || serviceData.customDuration !== undefined) {
        updateData.duration_minutes = serviceData.duration || serviceData.customDuration;
      }
      if (serviceData.customDuration !== undefined) {
        updateData.custom_duration = serviceData.customDuration;
      }
      if (serviceData.isEnabled !== undefined || serviceData.is_enabled !== undefined) {
        updateData.is_enabled = serviceData.isEnabled !== undefined ? serviceData.isEnabled : serviceData.is_enabled;
      }
      if (serviceData.publishStatus !== undefined || serviceData.publish_status !== undefined) {
        updateData.publish_status = serviceData.publishStatus || serviceData.publish_status;
      }
      if (serviceData.description !== undefined) {
        updateData.custom_description = serviceData.description;
      }

      // ✅ FIX: Validate that at least one field is being updated
      if (Object.keys(updateData).length === 0) {
        return c.json({ error: 'No valid fields to update. Please provide at least one field: price, duration, isEnabled, or publishStatus' }, 400);
      }

      // ✅ FIX: Handle both UUID and text service identifiers
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(serviceId);
      
      let updated: any[];
      
      if (isUUID) {
        // Direct UUID lookup by vendor_services.id or vendor_services.service_id
        updated = await update('vendor_services',
          { id: serviceId, vendor_id: vendorId },
          updateData
        );
        
        // If not found by id, try by service_id (foreign key to service catalog)
        if (updated.length === 0) {
          updated = await update('vendor_services',
            { service_id: serviceId, vendor_id: vendorId },
            updateData
          );
        }
      } else {
        // ✅ FIX: Text identifier - try multiple matching strategies
        console.log(`[VendorServices PUT] Looking up text service ID: ${serviceId} for vendor ${vendorId}`);
        
        // Strategy 1: Look up from service_catalog by service_id
        const catalogResult = await query(
          'SELECT id FROM service_catalog WHERE service_id = $1',
          [serviceId]
        );
        
        if (catalogResult.rows.length > 0) {
          const catalogUUID = catalogResult.rows[0].id;
          updated = await update('vendor_services',
            { service_id: catalogUUID, vendor_id: vendorId },
            updateData
          );
        } else {
          updated = [];
        }
        
        // Strategy 2: If not found, try matching by normalized service_name
        if (!updated || updated.length === 0) {
          // Convert underscore-separated identifiers to space-separated for fuzzy matching
          // e.g., "vet_tele_consult" -> "tele consult" (remove common prefixes)
          const normalizedSearch = serviceId
            .replace(/^vet_|^pet_/, '') // Remove common prefixes
            .replace(/_/g, ' ')          // Convert underscores to spaces
            .replace(/-/g, ' ')          // Convert hyphens to spaces
            .trim();
          
          console.log(`[VendorServices PUT] Trying normalized search: "${normalizedSearch}"`);
          
          const vsResult = await query(
            `UPDATE vendor_services 
             SET ${Object.keys(updateData).map((k, i) => `${k} = $${i + 3}`).join(', ')}, updated_at = NOW()
             WHERE vendor_id = $1 AND (
               LOWER(service_name) ILIKE '%' || LOWER($2) || '%'
               OR LOWER(REPLACE(REPLACE(service_name, '-', ' '), '_', ' ')) ILIKE '%' || LOWER($2) || '%'
             )
             RETURNING *`,
            [vendorId, normalizedSearch, ...Object.values(updateData)]
          );
          updated = vsResult.rows;
        }
        
        // Strategy 3: Try exact original serviceId match
        if (!updated || updated.length === 0) {
          const vsResult = await query(
            `UPDATE vendor_services 
             SET ${Object.keys(updateData).map((k, i) => `${k} = $${i + 3}`).join(', ')}, updated_at = NOW()
             WHERE vendor_id = $1 AND (
               service_name ILIKE $2 
               OR service_name ILIKE '%' || $2 || '%'
               OR LOWER(REPLACE(REPLACE(service_name, '-', ''), ' ', '')) = LOWER(REPLACE(REPLACE($2, '_', ''), '-', ''))
             )
             RETURNING *`,
            [vendorId, serviceId, ...Object.values(updateData)]
          );
          updated = vsResult.rows;
        }
      }

      if (!updated || updated.length === 0) {
        return c.json({ error: 'Service not found or you do not have permission to update it' }, 404);
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

  // ============================================================================
  // IMPORTANT: Register specific POST routes BEFORE the generic :serviceId route
  // Hono matches routes in registration order
  // ============================================================================

  /**
   * POST /vendor/:vendorId/services/add-from-catalog
   * Add a platform catalog service to vendor's offerings
   * MUST be registered before the generic :serviceId route
   */
  app.post("/vendor/:vendorId/services/add-from-catalog", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      // ✅ CRITICAL FIX: Ensure vendor exists in vendors table before inserting
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
      
      // Check if vendor has services capability (use actualVendorId)
      const hasServicesCapability = await checkVendorCapability(actualVendorId, 'services') || 
                                     await checkVendorCapability(actualVendorId, 'custom_services');
      if (!hasServicesCapability) {
        return c.json({ error: 'Vendor does not have services capability' }, 403);
      }
      
      const body = await c.req.json();
      const {
        catalogServiceId,
        serviceId: bodyServiceId, // Also accept serviceId from body
        serviceStyle,
        customPrice,
        customDuration,
        isEnabled = true
      } = body;
      
      const finalCatalogServiceId = catalogServiceId || bodyServiceId;
      
      if (!finalCatalogServiceId) {
        return c.json({ error: 'catalogServiceId or serviceId is required' }, 400);
      }
      
      console.log(`➕ Adding catalog service ${finalCatalogServiceId} to vendor ${actualVendorId}...`);
      
      // Check if catalogServiceId is UUID or text identifier
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(finalCatalogServiceId);
      
      let catalogService: any;
      
      if (isUUID) {
        const catalogServices = await query(
          `SELECT * FROM service_catalog WHERE id = $1`,
          [finalCatalogServiceId]
        );
        catalogService = catalogServices.rows[0];
      } else {
        // Look up by text service_id
        const catalogServices = await query(
          `SELECT * FROM service_catalog WHERE service_id = $1`,
          [finalCatalogServiceId]
        );
        catalogService = catalogServices.rows[0];
      }
      
      if (!catalogService) {
        return c.json({ error: `Catalog service not found: ${finalCatalogServiceId}` }, 404);
      }
      
      const finalServiceStyle = serviceStyle || catalogService.service_style || 'at_home';
      
      // Check if vendor already has this service (use actualVendorId)
      const existingServices = await query(
        `SELECT * FROM vendor_services 
         WHERE vendor_id = $1 
         AND (service_id = $2 OR service_name = $3)
         AND service_style = $4`,
        [actualVendorId, catalogService.id, catalogService.service_name, finalServiceStyle]
      );
      
      if (existingServices.rows.length > 0) {
        // Update existing service to enabled
        const existingService = existingServices.rows[0];
        const updated = await update('vendor_services', 
          { id: existingService.id },
          { 
            is_enabled: isEnabled,
            custom_price: customPrice || existingService.custom_price,
            custom_duration: customDuration || existingService.custom_duration,
          }
        );
        
        return c.json({
          success: true,
          message: 'Service updated/re-enabled',
          vendorServiceId: existingService.id,
          service: updated[0] || existingService
        });
      }
      
      // Create new vendor_services record (use actualVendorId)
      const vendorServiceId = crypto.randomUUID();
      
      const newService = await insert('vendor_services', {
        id: vendorServiceId,
        vendor_id: actualVendorId,
        service_id: catalogService.id,
        service_name: catalogService.service_name || catalogService.display_name,
        category: catalogService.category_id || catalogService.category_name,
        sub_category: catalogService.sub_category_id || catalogService.sub_category_name,
        price: customPrice || catalogService.base_price || 0,
        duration_minutes: customDuration || catalogService.duration_minutes || 30,
        service_style: finalServiceStyle,
        is_enabled: isEnabled,
        publish_status: 'draft',
        is_custom_service: false,
        custom_price: customPrice,
        custom_duration: customDuration,
      });
      
      console.log(`✅ Created vendor service ${vendorServiceId} for vendor ${actualVendorId}`);
      
      return c.json({
        success: true,
        message: 'Service added from catalog',
        vendorServiceId,
        service: newService[0]
      });
    } catch (error: any) {
      console.error('Error adding catalog service to vendor:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/services/:serviceId
   * Update vendor service (alias for PUT to support frontend using POST)
   * NOTE: This generic route is registered AFTER specific routes
   */
  app.post("/vendor/:vendorId/services/:serviceId", async (c) => {
    // Skip if this is a specific route that should have been handled above
    const serviceId = c.req.param('serviceId');
    if (serviceId === 'custom' || serviceId === 'add-from-catalog') {
      // These should have been handled by specific routes above
      // If we get here, something is wrong with route registration
      console.error(`⚠️ Generic :serviceId route caught specific path: ${serviceId}`);
      return c.json({ error: 'Route configuration error' }, 500);
    }
    
    try {
      const { vendorId } = c.req.param();
      
      // Check if vendor has services or custom_services capability
      const hasServicesCapability = await checkVendorCapability(vendorId, 'services') || 
                                     await checkVendorCapability(vendorId, 'custom_services');
      if (!hasServicesCapability) {
        return c.json({ error: 'Vendor does not have services capability' }, 403);
      }
      
      const serviceData = await c.req.json();

      const updateData: any = {};
      
      if (serviceData.price !== undefined || serviceData.customPrice !== undefined) {
        updateData.price = serviceData.price || serviceData.customPrice;
      }
      if (serviceData.customPrice !== undefined) {
        updateData.custom_price = serviceData.customPrice;
      }
      if (serviceData.duration !== undefined || serviceData.customDuration !== undefined) {
        updateData.duration_minutes = serviceData.duration || serviceData.customDuration;
      }
      if (serviceData.customDuration !== undefined) {
        updateData.custom_duration = serviceData.customDuration;
      }
      if (serviceData.isEnabled !== undefined || serviceData.is_enabled !== undefined) {
        updateData.is_enabled = serviceData.isEnabled !== undefined ? serviceData.isEnabled : serviceData.is_enabled;
      }
      if (serviceData.publishStatus !== undefined || serviceData.publish_status !== undefined) {
        updateData.publish_status = serviceData.publishStatus || serviceData.publish_status;
      }
      if (serviceData.description !== undefined) {
        updateData.custom_description = serviceData.description;
      }

      if (Object.keys(updateData).length === 0) {
        return c.json({ error: 'No valid fields to update. Please provide at least one field: price, duration, isEnabled, or publishStatus' }, 400);
      }

      // ✅ FIX: Handle both UUID and text service identifiers with improved matching
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(serviceId);
      
      let updated: any[];
      
      if (isUUID) {
        updated = await update('vendor_services',
          { id: serviceId, vendor_id: vendorId },
          updateData
        );
        
        if (updated.length === 0) {
          updated = await update('vendor_services',
            { service_id: serviceId, vendor_id: vendorId },
            updateData
          );
        }
      } else {
        // ✅ FIX: Text identifier - try multiple matching strategies
        console.log(`[VendorServices] Looking up text service ID: ${serviceId} for vendor ${vendorId}`);
        
        // Strategy 1: Look up from service_catalog by service_id
        const catalogResult = await query(
          'SELECT id FROM service_catalog WHERE service_id = $1',
          [serviceId]
        );
        
        if (catalogResult.rows.length > 0) {
          const catalogUUID = catalogResult.rows[0].id;
          updated = await update('vendor_services',
            { service_id: catalogUUID, vendor_id: vendorId },
            updateData
          );
        } else {
          updated = [];
        }
        
        // Strategy 2: If not found, try matching by normalized service_name
        if (!updated || updated.length === 0) {
          // Convert underscore-separated identifiers to space-separated for fuzzy matching
          // e.g., "vet_tele_consult" -> "tele consult" (remove common prefixes)
          const normalizedSearch = serviceId
            .replace(/^vet_|^pet_/, '') // Remove common prefixes
            .replace(/_/g, ' ')          // Convert underscores to spaces
            .replace(/-/g, ' ')          // Convert hyphens to spaces
            .trim();
          
          console.log(`[VendorServices] Trying normalized search: "${normalizedSearch}"`);
          
          const vsResult = await query(
            `UPDATE vendor_services 
             SET ${Object.keys(updateData).map((k, i) => `${k} = $${i + 3}`).join(', ')}, updated_at = NOW()
             WHERE vendor_id = $1 AND (
               LOWER(service_name) ILIKE '%' || LOWER($2) || '%'
               OR LOWER(REPLACE(REPLACE(service_name, '-', ' '), '_', ' ')) ILIKE '%' || LOWER($2) || '%'
             )
             RETURNING *`,
            [vendorId, normalizedSearch, ...Object.values(updateData)]
          );
          updated = vsResult.rows;
        }
        
        // Strategy 3: Try exact original serviceId match
        if (!updated || updated.length === 0) {
          const vsResult = await query(
            `UPDATE vendor_services 
             SET ${Object.keys(updateData).map((k, i) => `${k} = $${i + 3}`).join(', ')}, updated_at = NOW()
             WHERE vendor_id = $1 AND (
               service_name ILIKE $2 
               OR service_name ILIKE '%' || $2 || '%'
               OR LOWER(REPLACE(REPLACE(service_name, '-', ''), ' ', '')) = LOWER(REPLACE(REPLACE($2, '_', ''), '-', ''))
             )
             RETURNING *`,
            [vendorId, serviceId, ...Object.values(updateData)]
          );
          updated = vsResult.rows;
        }
      }

      if (!updated || updated.length === 0) {
        return c.json({ error: 'Service not found or you do not have permission to update it' }, 404);
      }

      return c.json({
        success: true,
        service: updated[0],
        message: 'Service updated successfully',
      });
    } catch (error: any) {
      console.error('Error updating vendor service (POST):', error);
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
      
      // ✅ Get vendor to determine serviceStyle
      const vendors = await select('vendors', { id: vendorId });
      if (vendors.length === 0) {
        return c.json({ error: 'Vendor not found' }, 404);
      }
      const vendor = vendors[0];
      
      const serviceData = await c.req.json();
      const {
        serviceName,
        description,
        category, // API accepts 'category'
        categoryName, // ✅ NEW: Also accept 'categoryName' from UI
        subCategory,
        subCategoryName, // ✅ NEW: Also accept 'subCategoryName' from UI
        serviceStyle, // Optional: can be derived from vendor
        price,
        duration,
      } = serviceData;

      // ✅ FIX: Map categoryName to category if category is not provided
      const effectiveCategory = category || categoryName || null;
      const effectiveSubCategory = subCategory || subCategoryName || null;

      // ✅ FIX: Determine serviceStyle from vendor if not provided
      // IMPORTANT: Respect explicitly passed serviceStyle from the UI (at_home, at_center, tele)
      let effectiveServiceStyle: string;
      
      if (serviceStyle && ['at_home', 'at_center', 'tele'].includes(serviceStyle)) {
        // If serviceStyle is explicitly provided and valid, use it
        effectiveServiceStyle = serviceStyle;
        console.log(`[VendorServices] Using explicitly provided serviceStyle: ${effectiveServiceStyle}`);
      } else {
        // Fallback: determine from vendor config or default
        effectiveServiceStyle = vendor.service_style || vendor.serviceStyle || 'at_center';
        console.log(`[VendorServices] No serviceStyle provided, falling back to: ${effectiveServiceStyle}`);
      }

      // ✅ PHASE 0.4: Validate serviceStyle against role configuration
      if (vendor.role_id) {
        try {
          const roles = await select('roles', { id: vendor.role_id });
          if (roles.length > 0) {
            const roleConfig = roles[0].config || {};
            const rawStyles = roleConfig?.serviceStyles || roleConfig?.service_styles || [];
            
            // Map role config styles to database styles
            const styleMapping: Record<string, string> = {
              'at_clinic': 'at_center',
              'at_center': 'at_center',
              'video_consultation': 'tele',
              'tele': 'tele',
              'home_visit': 'at_home',
              'at_home': 'at_home',
            };
            const allowedServiceStyles = rawStyles.length > 0 
              ? rawStyles.map((s: string) => styleMapping[s] || s)
              : ['at_home', 'at_center', 'tele']; // Default if no config
            
            // Validate serviceStyle against allowed styles
            if (!allowedServiceStyles.includes(effectiveServiceStyle)) {
              return c.json({ 
                error: `Service style '${effectiveServiceStyle}' is not allowed for this role. Allowed styles: ${allowedServiceStyles.join(', ')}`,
                allowedStyles: allowedServiceStyles
              }, 403);
            }
            
            console.log(`[VendorServices] ✅ Custom service style validation passed: ${effectiveServiceStyle} is allowed for vendor ${vendorId}`);
          }
        } catch (roleError: any) {
          console.warn(`[VendorServices] Failed to validate custom service style against role config:`, roleError.message);
          // Continue without validation if role config lookup fails (graceful degradation)
        }
      }

      // ✅ FIX: Category is required in vendor_services table - validate it
      if (!effectiveCategory) {
        return c.json({ error: 'category (or categoryName) is required' }, 400);
      }

      if (!serviceName || !price) {
        return c.json({ error: 'serviceName and price are required' }, 400);
      }

      // Create base service first
      // Note: services table requires price column (not null constraint)
      const baseService = await insert('services', {
        name: serviceName,
        description: description || null,
        category: effectiveCategory, // ✅ Use effective category
        price: price, // Required column
        duration_minutes: duration || 30,
        is_active: true,
        // Don't include: service_style, is_global (stored in vendor_services)
      });

      // ✅ FIX: Extract publishStatus from request - default to 'pending_approval' for approval workflow
      const requestedPublishStatus = serviceData.publishStatus || 'pending_approval';
      // Custom services require approval - can be 'draft', 'pending_approval', never directly 'published'
      const effectivePublishStatus = requestedPublishStatus === 'published' ? 'pending_approval' : requestedPublishStatus;
      const isEnabled = effectivePublishStatus === 'published'; // Only enabled if published (won't happen for custom)

      // Create vendor service link
      const vendorService = await insert('vendor_services', {
        vendor_id: vendorId,
        service_id: baseService[0].id,
        service_name: serviceName,
        category: effectiveCategory, // ✅ Use effective category (required field)
        sub_category: effectiveSubCategory || null,
        service_style: effectiveServiceStyle, // ✅ Use effective service style
        price: price,
        custom_price: price,
        duration_minutes: duration || 30,
        custom_duration: duration || 30,
        is_enabled: isEnabled, // ✅ FIX: Only enabled when published
        publish_status: effectivePublishStatus, // ✅ FIX: Respect the publishStatus from request
        is_custom_service: true,
        submitted_for_approval_at: effectivePublishStatus === 'pending_approval' ? new Date().toISOString() : null,
      });

      return c.json({
        success: true,
        service: vendorService[0],
        message: effectivePublishStatus === 'draft' 
          ? 'Custom service saved as draft' 
          : 'Custom service submitted for admin approval',
        publishStatus: effectivePublishStatus,
      });
    } catch (error: any) {
      console.error('Error creating custom service:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/services/custom/:serviceId/publish
   * Submit a draft custom service for admin approval
   * Changes status from 'draft' to 'pending_approval'
   */
  app.post("/vendor/:vendorId/services/custom/:serviceId/publish", async (c) => {
    try {
      const { vendorId, serviceId } = c.req.param();
      
      // Check if vendor has services capability
      const hasServicesCapability = await checkVendorCapability(vendorId, 'services') || 
                                     await checkVendorCapability(vendorId, 'custom_services');
      if (!hasServicesCapability) {
        return c.json({ error: 'Vendor does not have services capability' }, 403);
      }
      
      // Get the service
      const services = await select('vendor_services', { 
        vendor_id: vendorId, 
        service_id: serviceId 
      });
      
      if (services.length === 0) {
        return c.json({ error: 'Service not found' }, 404);
      }
      
      const service = services[0];
      
      // Only draft services can be submitted for approval
      if (service.publish_status !== 'draft') {
        return c.json({ 
          error: `Cannot publish service with status '${service.publish_status}'. Only draft services can be submitted for approval.` 
        }, 400);
      }
      
      // Update to pending_approval
      await update(
        'vendor_services',
        { vendor_id: vendorId, service_id: serviceId },
        {
          publish_status: 'pending_approval',
          submitted_for_approval_at: new Date().toISOString(),
        }
      );
      
      return c.json({
        success: true,
        message: 'Service submitted for admin approval',
        publishStatus: 'pending_approval',
      });
    } catch (error: any) {
      console.error('Error publishing custom service:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/services/add-from-catalog
   * Add a platform catalog service to vendor's offerings
   * This creates a vendor_services record linked to a service_catalog entry
   */
  app.post("/vendor/:vendorId/services/add-from-catalog", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      // Check if vendor has services capability
      const hasServicesCapability = await checkVendorCapability(vendorId, 'services') || 
                                     await checkVendorCapability(vendorId, 'custom_services');
      if (!hasServicesCapability) {
        return c.json({ error: 'Vendor does not have services capability' }, 403);
      }
      
      const body = await c.req.json();
      const {
        catalogServiceId,
        serviceStyle,
        customPrice,
        customDuration,
        isEnabled = true
      } = body;
      
      if (!catalogServiceId) {
        return c.json({ error: 'catalogServiceId is required' }, 400);
      }
      
      console.log(`➕ Adding catalog service ${catalogServiceId} to vendor ${vendorId}...`);
      
      // Get the catalog service details
      const catalogServices = await query(
        `SELECT * FROM service_catalog WHERE id = $1`,
        [catalogServiceId]
      );
      
      if (catalogServices.rows.length === 0) {
        return c.json({ error: 'Catalog service not found' }, 404);
      }
      
      const catalogService = catalogServices.rows[0];
      
      // Check if vendor already has this service
      const existingServices = await query(
        `SELECT * FROM vendor_services 
         WHERE vendor_id = $1 
         AND (catalog_service_id = $2 OR service_id = $2)
         AND service_style = $3`,
        [vendorId, catalogServiceId, serviceStyle || catalogService.service_style]
      );
      
      if (existingServices.rows.length > 0) {
        // Update existing service to enabled
        const existingService = existingServices.rows[0];
        await update('vendor_services', 
          { 
            is_enabled: isEnabled,
            updated_at: new Date().toISOString()
          },
          { id: existingService.id }
        );
        
        return c.json({
          success: true,
          message: 'Service re-enabled',
          vendorServiceId: existingService.id,
          id: existingService.id
        });
      }
      
      // Create new vendor_services record
      const vendorServiceId = randomUUID();
      const finalServiceStyle = serviceStyle || catalogService.service_style || 'at_home';
      
      await insert('vendor_services', {
        id: vendorServiceId,
        vendor_id: vendorId,
        service_id: catalogServiceId, // Link to catalog service
        catalog_service_id: catalogServiceId,
        service_name: catalogService.service_name || catalogService.name,
        description: catalogService.description,
        custom_description: catalogService.description,
        category: catalogService.category_name || catalogService.category,
        sub_category: catalogService.sub_category_name || catalogService.sub_category,
        service_style: finalServiceStyle,
        price: customPrice || catalogService.base_price || catalogService.price,
        custom_price: customPrice || catalogService.base_price || catalogService.price,
        duration_minutes: customDuration || catalogService.duration || 30,
        custom_duration: customDuration || catalogService.duration || 30,
        is_enabled: isEnabled,
        is_custom_service: false, // This is a platform catalog service
        is_platform_managed: true,
        publish_status: 'published', // Platform services are auto-published
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      
      console.log(`✅ Added catalog service ${catalogService.service_name} to vendor ${vendorId} as ${vendorServiceId}`);
      
      return c.json({
        success: true,
        message: 'Service added to your offerings',
        vendorServiceId: vendorServiceId,
        id: vendorServiceId
      });
    } catch (error: any) {
      console.error('Error adding catalog service to vendor:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/services/bulk-publish
   * Bulk publish multiple services at once
   * Requires 'services' capability
   */
  app.post("/vendor/:vendorId/services/bulk-publish", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const body = await c.req.json();
      const { serviceIds, publishStatus = 'published' } = body;

      if (!serviceIds || !Array.isArray(serviceIds) || serviceIds.length === 0) {
        return c.json({ error: 'serviceIds array is required' }, 400);
      }

      // Check if vendor has services capability
      const hasServicesCapability = await checkVendorCapability(vendorId, 'services') || 
                                     await checkVendorCapability(vendorId, 'custom_services');
      if (!hasServicesCapability) {
        return c.json({ error: 'Vendor does not have services capability' }, 403);
      }

      // Validate publishStatus
      const validStatuses = ['draft', 'published', 'pending_approval'];
      if (!validStatuses.includes(publishStatus)) {
        return c.json({ error: `Invalid publishStatus. Must be one of: ${validStatuses.join(', ')}` }, 400);
      }

      // Bulk update services
      const placeholders = serviceIds.map((_, i) => `$${i + 2}`).join(', ');
      const params = [publishStatus, ...serviceIds, vendorId];
      const updateResult = await query(
        `UPDATE vendor_services 
         SET publish_status = $1, 
             is_enabled = CASE WHEN $1 = 'published' THEN true ELSE is_enabled END,
             updated_at = NOW()
         WHERE vendor_id = $${params.length}
           AND id IN (${placeholders})
         RETURNING id, service_name, publish_status, is_enabled`,
        params
      );

      const updatedServices = updateResult.rows.map((row: any) => ({
        id: row.id,
        serviceName: row.service_name,
        publishStatus: row.publish_status,
        isEnabled: row.is_enabled,
      }));

      return c.json({
        success: true,
        message: `Successfully updated ${updatedServices.length} service(s)`,
        updatedServices,
        count: updatedServices.length,
      });
    } catch (error: any) {
      console.error('Error bulk publishing services:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}

