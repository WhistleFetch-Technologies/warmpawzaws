/**
 * ============================================================================
 * VENDOR SERVICE MANAGEMENT - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * Vendor service management endpoints:
 * - Get available services for vendor (role-based and legacy)
 * - Get vendor's configured services
 * - Configure vendor services
 * - Publish services
 * - Add custom services/packages
 * - Unpublish/delete services
 * - Admin approval workflows
 * 
 * CHANGES:
 * - Removed `kv` imports
 * - Replaced all `kv.get()`, `kv.set()`, `kv.getByPrefix()` with repository calls
 * - Service catalog stored in platform_settings or services table
 * - Vendor services stored in vendor_services table
 * 
 * Date: 2024-12-22
 * Migration: Phase 5 - KV to SQL
 * ============================================================================
 */

import { Hono } from 'npm:hono';
import { sendSuccess, sendError } from './response-utils.ts';
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { getServicesRepository } from '../../lib/repositories/services.ts';
import { getStaffRepository } from '../../lib/repositories/staff.ts';
import { getNotificationsRepository } from '../../lib/repositories/notifications.ts';
import { getDbClient } from '../../lib/db.ts';

export function registerVendorServiceManagementRoutes(app: Hono) {
  
  // ============================================
  // DEBUG: CHECK CATALOG STATUS
  // ============================================
  app.get("/make-server-3dd53475/vendor/debug/catalog-status", async (c) => {
    try {
      const client = getDbClient();
      
      // ✅ SQL: Get service catalog from platform_settings or services table
      const { data: catalogSetting } = await client
        .from('platform_settings')
        .select('*')
        .eq('setting_key', 'platform:service_catalog')
        .maybeSingle();
      
      const catalog = catalogSetting?.setting_value || [];
      
      // ✅ SQL: Get category mappings
      const { data: categoryMappings } = await client
        .from('platform_settings')
        .select('*')
        .like('setting_key', 'service_category_mapping:%');
      
      return c.json({
        success: true,
        catalogCount: catalog.length,
        sampleServices: catalog.slice(0, 5),
        breakdown: {
          at_home: catalog.filter((s: any) => s.serviceStyle === 'at_home').length,
          at_center: catalog.filter((s: any) => s.serviceStyle === 'at_center').length,
          tele: catalog.filter((s: any) => s.serviceStyle === 'tele').length
        },
        categoryMappings: categoryMappings?.map((cm: any) => ({
          vendorType: cm.setting_key.replace('service_category_mapping:', ''),
          categories: cm.setting_value?.categories || []
        })) || []
      });
    } catch (error) {
      console.error('Error checking catalog status:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  // ============================================
  // GET AVAILABLE SERVICES FOR VENDOR (NEW ROLE-BASED)
  // ============================================
  /**
   * GET /make-server-3dd53475/vendor/:vendorId/services/:serviceStyle
   * Get available services for vendor based on their role and selected service style
   * 
   * REFACTORED: Uses SQL repositories instead of KV
   */
  app.get("/make-server-3dd53475/vendor/:vendorId/services/:serviceStyle", async (c) => {
    try {
      const { vendorId, serviceStyle } = c.req.param();
      
      console.log(`📋 [VENDOR-SERVICES-V2] Fetching available services for vendor ${vendorId}, style: ${serviceStyle}`);
      
      // ✅ CRITICAL FIX: Resolve vendor ID (handles both UUID and vendor_id string)
      const vendorsRepo = getVendorsRepository();
      const resolvedVendorId = await vendorsRepo.resolveVendorId(vendorId);
      
      if (!resolvedVendorId) {
        console.error(`❌ [VENDOR-SERVICES-V2] Vendor not found: ${vendorId}`);
        return c.json({ error: `Vendor not found: ${vendorId}` }, 404);
      }
      
      console.log(`✅ [VENDOR-SERVICES-V2] Resolved vendor ID: ${vendorId} -> ${resolvedVendorId}`);
      
      // ✅ SQL: Get vendor
      const vendor = await vendorsRepo.findById(resolvedVendorId);
      
      if (!vendor) {
        console.error(`❌ [VENDOR-SERVICES-V2] Vendor not found after resolution: ${resolvedVendorId}`);
        return c.json({ error: 'Vendor not found' }, 404);
      }
      
      const roleId = vendor.role_id;
      const vendorServiceStyle = vendor.service_style;
      
      console.log(`🏷️ [VENDOR-SERVICES-V2] Vendor roleId: ${roleId}, registered serviceStyle: ${vendorServiceStyle}`);
      
      // ✅ SQL: Get role configuration from platform_settings
      const client = getDbClient();
      const { data: roleSetting } = await client
        .from('platform_settings')
        .select('*')
        .eq('setting_key', `role:config:${roleId}`)
        .maybeSingle();
      
      const roleConfig = roleSetting?.setting_value || {};
      
      if (!roleConfig || !roleConfig.id) {
        console.error(`❌ [VENDOR-SERVICES-V2] Role config not found for roleId: ${roleId}`);
        return c.json({ 
          services: [],
          message: `Role configuration not found for ${roleId}. Please contact admin.`
        });
      }
      
      console.log(`✅ [VENDOR-SERVICES-V2] Role config found:`, {
        roleId: roleConfig.id,
        roleName: roleConfig.name,
        allowedStyles: roleConfig.serviceStyles
      });
      
      // 3. Verify this service style is allowed for this role
      if (!roleConfig.serviceStyles || !roleConfig.serviceStyles.includes(serviceStyle)) {
        console.warn(`⚠️ [VENDOR-SERVICES-V2] Service style ${serviceStyle} not allowed for role ${roleId}`);
        return c.json({
          services: [],
          message: `Service style "${serviceStyle}" is not available for your vendor type`
        });
      }
      
      // ✅ SQL: Get all services from catalog (platform_settings or services table)
      const { data: catalogSetting } = await client
        .from('platform_settings')
        .select('*')
        .eq('setting_key', 'platform:service_catalog')
        .maybeSingle();
      
      const allServices = catalogSetting?.setting_value || [];
      console.log(`📚 [VENDOR-SERVICES-V2] Total catalog services: ${allServices.length}`);
      
      // Filter services by role and style
      const availableServices = allServices.filter((service: any) => {
        const applicableRoles = service.applicableRoles || [];
        const matchesRole = applicableRoles.includes(roleId);
        
        const serviceStyleValue = service.serviceStyle || service.serviceStyles;
        let matchesStyle = false;
        
        if (Array.isArray(serviceStyleValue)) {
          matchesStyle = serviceStyleValue.includes(serviceStyle);
        } else if (serviceStyleValue) {
          matchesStyle = serviceStyleValue === serviceStyle;
        }
        
        const isActive = service.isActive !== false;
        
        return matchesRole && matchesStyle && isActive;
      }).map((service: any) => ({
        id: service.catalogId || service.id,
        name: service.serviceName || service.name,
        description: service.description,
        categoryName: service.categoryName || service.serviceCategoryName || service.category,
        subCategoryName: service.subCategoryName || service.subCategory,
        duration: service.duration || 30,
        price: service.basePrice || service.price || 0,
        serviceStyles: service.serviceStyles || (service.serviceStyle ? [service.serviceStyle] : []),
        isPlatformManaged: serviceStyle === 'at_home' || serviceStyle === 'tele',
        isPackage: service.isPackage || false,
        packageDetails: service.packageDetails,
        whatIncluded: service.whatIncluded || service.includes || [],
        whatNotIncluded: service.whatNotIncluded || service.excludes || [],
        requirements: service.requirements || [],
        petTypes: service.petTypes || [],
        applicableRoles: service.applicableRoles || [],
        icon: service.icon || '🔧'
      }));
      
      console.log(`✅ [VENDOR-SERVICES-V2] Found ${availableServices.length} matching services`);
      
      // ✅ SQL: Get vendor's configured services from vendor_services table
      // ✅ CRITICAL FIX: Use resolved vendor ID (UUID) not the original string
      const { data: vendorServicesData } = await client
        .from('vendor_services')
        .select('*')
        .eq('vendor_id', resolvedVendorId) // ✅ Use UUID, not vendor_id string
        .eq('service_style', serviceStyle)
        .maybeSingle();
      
      const vendorServices = vendorServicesData?.services || [];
      console.log(`📦 [VENDOR-SERVICES-V2] Vendor has ${vendorServices.length} configured services`);
      
      // Mark which catalog services are already enabled
      const catalogServicesWithStatus = availableServices.map((service: any) => {
        const vendorService = vendorServices.find((vs: any) => vs.serviceId === service.id);
        return {
          ...service,
          isEnabled: vendorService?.is_enabled || false,
          customPrice: vendorService?.custom_price,
          customDuration: vendorService?.custom_duration,
          customDescription: vendorService?.custom_description,
          publishStatus: vendorService?.publish_status || 'draft',
          isCustomService: false
        };
      });
      
      // Get custom services
      const customServices = vendorServices
        .filter((vs: any) => vs.is_custom_service === true)
        .map((vs: any) => ({
          id: vs.service_id,
          name: vs.service_name,
          description: vs.custom_description || vs.description || '',
          categoryName: vs.category_name || 'Custom',
          subCategoryName: vs.sub_category_name || '',
          duration: vs.custom_duration || vs.duration || 30,
          price: vs.custom_price || 0,
          isPlatformManaged: false,
          isPackage: vs.is_package || false,
          packageDetails: vs.package_details,
          whatIncluded: [],
          whatNotIncluded: [],
          requirements: [],
          petTypes: [],
          applicableRoles: [roleId],
          icon: '⭐',
          isEnabled: vs.is_enabled || true,
          customPrice: vs.custom_price,
          customDuration: vs.custom_duration,
          customDescription: vs.custom_description,
          publishStatus: vs.publish_status || 'draft',
          isCustomService: true
        }));
      
      console.log(`⭐ [VENDOR-SERVICES-V2] Found ${customServices.length} custom services`);
      
      // Combine catalog services and custom services
      const combinedServices = [...catalogServicesWithStatus, ...customServices];
      
      console.log(`✅ [VENDOR-SERVICES-V2] Returning ${combinedServices.length} total services`);
      
      return c.json({
        success: true,
        roleId,
        roleName: roleConfig.name,
        serviceStyle,
        services: combinedServices,
        isPlatformManaged: serviceStyle === 'at_home' || serviceStyle === 'tele'
      });
      
    } catch (error) {
      console.error('❌ [VENDOR-SERVICES-V2] Error fetching available services:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  // ============================================
  // GET VENDOR'S CONFIGURED SERVICES
  // ============================================
  /**
   * GET /make-server-3dd53475/vendor/:vendorId/services
   * 
   * REFACTORED: Uses SQL repositories instead of KV
   */
  app.get("/make-server-3dd53475/vendor/:vendorId/services", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      console.log(`📋 [VENDOR-SERVICES] Fetching configured services for vendor ${vendorId}`);
      
      // ✅ CRITICAL FIX: Resolve vendor ID (handles both UUID and vendor_id string)
      const vendorsRepo = getVendorsRepository();
      const resolvedVendorId = await vendorsRepo.resolveVendorId(vendorId);
      
      if (!resolvedVendorId) {
        console.error(`❌ [VENDOR-SERVICES] Vendor not found: ${vendorId}`);
        return c.json({ error: `Vendor not found: ${vendorId}` }, 404);
      }
      
      console.log(`✅ [VENDOR-SERVICES] Resolved vendor ID: ${vendorId} -> ${resolvedVendorId}`);
      
      // ✅ SQL: Get vendor
      const vendor = await vendorsRepo.findById(resolvedVendorId);
      
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }
      
      // ✅ SQL: Get all service styles configured for this vendor
      const client = getDbClient();
      const { data: vendorServices } = await client
        .from('vendor_services')
        .select('*')
        .eq('vendor_id', resolvedVendorId) // ✅ Use UUID, not vendor_id string;
      
      const serviceStyles = ['at_home', 'at_center', 'tele'];
      const allVendorServices: any = {
        at_home: { services: [], publishedCount: 0 },
        at_center: { services: [], publishedCount: 0 },
        tele: { services: [], publishedCount: 0 }
      };
      
      for (const style of serviceStyles) {
        const styleServices = vendorServices?.filter((vs: any) => vs.service_style === style) || [];
        allVendorServices[style] = {
          services: styleServices,
          publishedCount: styleServices.filter((s: any) => s.publish_status === 'published').length
        };
      }
      
      return c.json({
        success: true,
        vendorId,
        vendorType: vendor.category,
        services: allVendorServices
      });
      
    } catch (error) {
      console.error('❌ [VENDOR-SERVICES] Error fetching vendor services:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  // ============================================
  // UPDATE VENDOR SERVICE CONFIGURATION
  // ============================================
  /**
   * POST /make-server-3dd53475/vendor/:vendorId/services/configure
   * 
   * REFACTORED: Uses SQL repositories instead of KV
   */
  app.post("/make-server-3dd53475/vendor/:vendorId/services/configure", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const { serviceStyle, services } = await c.req.json();
      
      console.log(`🔧 [VENDOR-SERVICES] Configuring services for vendor ${vendorId}, style: ${serviceStyle}`);
      console.log(`📊 [VENDOR-SERVICES] Number of services: ${services.length}`);
      
      // ✅ CRITICAL FIX: Resolve vendor ID (handles both UUID and vendor_id string)
      const vendorsRepo = getVendorsRepository();
      const resolvedVendorId = await vendorsRepo.resolveVendorId(vendorId);
      
      if (!resolvedVendorId) {
        console.error(`❌ [VENDOR-SERVICES] Vendor not found: ${vendorId}`);
        return c.json({ error: `Vendor not found: ${vendorId}` }, 404);
      }
      
      console.log(`✅ [VENDOR-SERVICES] Resolved vendor ID: ${vendorId} -> ${resolvedVendorId}`);
      
      // ✅ SQL: Validate vendor exists
      const vendor = await vendorsRepo.findById(resolvedVendorId);
      
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }
      
      // Determine if platform managed
      const isPlatformManaged = serviceStyle === 'at_home' || serviceStyle === 'tele';
      
      // Validate service configurations
      for (const service of services) {
        if (isPlatformManaged) {
          // For platform-managed services, vendor can only enable/disable
          if (service.customPrice !== undefined || service.customDuration !== undefined) {
            console.warn(`⚠️ [VENDOR-SERVICES] Ignoring custom price/duration for platform-managed service: ${service.serviceId}`);
            delete service.customPrice;
            delete service.customDuration;
          }
        } else {
          // For at_center, validate pricing
          if (service.isEnabled) {
            const hasValidPrice = (service.customPrice && service.customPrice > 0) || (service.price && service.price > 0);
            if (!hasValidPrice) {
              return c.json({ 
                error: `Price is required for service: ${service.serviceName}` 
              }, 400);
            }
            if (!service.customPrice && service.price) {
              service.customPrice = service.price;
            }
          }
        }
      }
      
      // ✅ SQL: Save vendor service configuration
      const client = getDbClient();
      
      // Get existing vendor services
      // ✅ CRITICAL FIX: Use resolved vendor ID (UUID) not the original string
      const { data: existingServices } = await client
        .from('vendor_services')
        .select('*')
        .eq('vendor_id', resolvedVendorId) // ✅ Use UUID, not vendor_id string
        .eq('service_style', serviceStyle);
      
      // Upsert each service
      for (const s of services) {
        const isCustomService = s.isNewService || false;
        const publishStatus = isCustomService ? 'draft' : 'published';
        
        await client
          .from('vendor_services')
          .upsert({
            vendor_id: resolvedVendorId, // ✅ Use UUID, not vendor_id string
            service_style: serviceStyle,
            service_id: s.serviceId,
            service_name: s.serviceName,
            is_enabled: s.isEnabled,
            custom_price: s.customPrice,
            custom_duration: s.customDuration,
            custom_description: s.customDescription,
            publish_status: publishStatus,
            published_at: !isCustomService ? new Date().toISOString() : null,
            approval_status: !isCustomService ? 'auto_approved' : null,
            is_custom_service: isCustomService,
            category_name: s.categoryName,
            sub_category_name: s.subCategoryName,
            description: s.description,
            configured_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'vendor_id,service_style,service_id'
          });
      }
      
      console.log(`✅ [VENDOR-SERVICES] Services configured successfully`);
      
      return c.json({
        success: true,
        message: 'Services configured successfully',
        isPlatformManaged,
        requiresApproval: !isPlatformManaged
      });
      
    } catch (error) {
      console.error('❌ [VENDOR-SERVICES] Error configuring services:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  // ============================================
  // PUBLISH SERVICES
  // ============================================
  /**
   * POST /make-server-3dd53475/vendor/:vendorId/services/publish
   * 
   * REFACTORED: Uses SQL repositories instead of KV
   */
  app.post("/make-server-3dd53475/vendor/:vendorId/services/publish", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const { serviceStyle } = await c.req.json();
      
      console.log(`🚀 [VENDOR-SERVICES] Publishing services for vendor ${vendorId}, style: ${serviceStyle}`);
      
      // ✅ CRITICAL FIX: Resolve vendor ID (handles both UUID and vendor_id string)
      const vendorsRepo = getVendorsRepository();
      const resolvedVendorId = await vendorsRepo.resolveVendorId(vendorId);
      
      if (!resolvedVendorId) {
        console.error(`❌ [VENDOR-SERVICES] Vendor not found: ${vendorId}`);
        return c.json({ error: `Vendor not found: ${vendorId}` }, 404);
      }
      
      console.log(`✅ [VENDOR-SERVICES] Resolved vendor ID: ${vendorId} -> ${resolvedVendorId}`);
      
      // ✅ SQL: Get vendor
      const vendor = await vendorsRepo.findById(resolvedVendorId);
      
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }
      
      // ✅ SQL: Check staff requirements
      const staffList = await getStaffRepository().findByVendor(resolvedVendorId); // ✅ Use UUID
      
      const isSoloProvider = vendor.category === 'service_provider' ||
                            ['pet_walker', 'nutritionist', 'pet_sitter', 'pet_trainer'].includes(vendor.role_id || '');
      
      const isCenterBased = vendor.category === 'healthcare_provider' ||
                           vendor.service_style === 'at_center' ||
                           ['veterinary_clinic', 'pet_boarding', 'pet_resort', 'pet_cafe'].includes(vendor.role_id || '');
      
      // Solo providers can publish without staff
      if (isSoloProvider && staffList.length === 0) {
        // Auto-create staff profile for solo vendor
        await getStaffRepository().create({
          vendor_id: resolvedVendorId, // ✅ Use UUID, not vendor_id string
          full_name: vendor.owner_name || vendor.business_name,
          phone: vendor.phone,
          email: vendor.email,
          role_type: vendor.role_id || 'staff',
          is_active: true,
        });
        
        console.log(`✅ Auto-created staff profile for solo vendor: ${vendorId}`);
      }
      
      // Center-based vendors still need staff
      if (isCenterBased && staffList.length === 0) {
        console.error(`❌ [VENDOR-SERVICES] Cannot publish: Center-based vendor ${vendorId} has no staff members`);
        return c.json({ 
          error: 'Cannot publish services without staff',
          message: 'Center-based vendors must have at least one staff member before publishing services.',
          requiresStaff: true,
          isCenterBased: true
        }, 400);
      }
      
      console.log(`✅ [VENDOR-SERVICES] Vendor has ${staffList.length} staff member(s)`);
      
      // ✅ SQL: Get vendor services
      // ✅ CRITICAL FIX: Use resolved vendor ID (UUID) not the original string
      const client = getDbClient();
      const { data: vendorServices } = await client
        .from('vendor_services')
        .select('*')
        .eq('vendor_id', resolvedVendorId) // ✅ Use UUID, not vendor_id string
        .eq('service_style', serviceStyle)
        .eq('is_enabled', true);
      
      if (!vendorServices || vendorServices.length === 0) {
        return c.json({ error: 'No services enabled' }, 400);
      }
      
      // Separate catalog and custom services
      const customServices = vendorServices.filter((s: any) => s.is_custom_service);
      const catalogServices = vendorServices.filter((s: any) => !s.is_custom_service);
      
      console.log(`📊 [VENDOR-SERVICES] Service breakdown:`);
      console.log(`   ✅ Platform catalog services (auto-approve): ${catalogServices.length}`);
      console.log(`   📋 Custom/new services (require approval): ${customServices.length}`);
      
      // AUTO-APPROVE: All catalog services
      if (catalogServices.length > 0) {
        for (const service of catalogServices) {
          await client
            .from('vendor_services')
            .update({
              publish_status: 'published',
              published_at: new Date().toISOString(),
              approval_status: 'auto_approved',
              updated_at: new Date().toISOString(),
            })
            .eq('id', service.id);
        }
        console.log(`✅ [AUTO-APPROVE] ${catalogServices.length} catalog services set to "published" immediately`);
      }
      
      // ONLY custom services need approval
      if (customServices.length > 0) {
        const requestId = `RATE_REQ_${Date.now()}`;
        
        // ✅ SQL: Create approval request in platform_settings or dedicated table
        await client
          .from('platform_settings')
          .upsert({
            setting_key: `rate_change_request:${requestId}`,
            setting_value: {
              id: requestId,
              vendor_id: resolvedVendorId, // ✅ Use UUID for consistency
              vendor_id_string: vendorId, // ✅ Keep original string for reference
              vendor_name: vendor.owner_name || vendor.business_name,
              business_name: vendor.business_name,
              vendor_type: vendor.category,
              service_style: serviceStyle,
              services: customServices.map((s: any) => ({
                serviceId: s.service_id,
                serviceName: s.service_name,
                customPrice: s.custom_price,
                customDuration: s.custom_duration,
                customDescription: s.custom_description,
                isCustomService: s.is_custom_service,
                isNewService: true,
                categoryName: s.category_name,
                subCategoryName: s.sub_category_name,
                description: s.description,
              })),
              status: 'pending',
              request_type: 'custom_service_approval',
              submitted_at: new Date().toISOString(),
            },
            updated_at: new Date().toISOString(),
          });
        
        // Mark custom services as pending approval
        for (const service of customServices) {
          await client
            .from('vendor_services')
            .update({
              publish_status: 'pending_approval',
              approval_request_id: requestId,
              updated_at: new Date().toISOString(),
            })
            .eq('id', service.id);
        }
        
        console.log(`📋 [REQUIRE-APPROVAL] Created approval request: ${requestId} for ${customServices.length} custom services`);
      }
      
      const publishedCount = catalogServices.length;
      const pendingCount = customServices.length;
      
      if (pendingCount > 0 && publishedCount > 0) {
        return c.json({
          success: true,
          message: `${publishedCount} catalog services published instantly, ${pendingCount} custom services pending admin approval`,
          publishedCount,
          pendingCount,
          status: 'mixed'
        });
      } else if (pendingCount > 0) {
        return c.json({
          success: true,
          message: `${pendingCount} custom services submitted for admin approval`,
          publishedCount: 0,
          pendingCount,
          status: 'pending_approval'
        });
      } else {
        return c.json({
          success: true,
          message: `${publishedCount} services published successfully`,
          publishedCount,
          status: 'published'
        });
      }
      
    } catch (error) {
      console.error('❌ [VENDOR-SERVICES] Error publishing services:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  // ============================================
  // ADD CUSTOM SERVICE (at_center only)
  // ============================================
  /**
   * POST /make-server-3dd53475/vendor/:vendorId/services/add-custom
   * 
   * REFACTORED: Uses SQL repositories instead of KV
   */
  app.post("/make-server-3dd53475/vendor/:vendorId/services/add-custom", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const requestBody = await c.req.json();
      const { 
        serviceStyle, 
        serviceName, 
        description, 
        duration, 
        price, 
        categoryName, 
        subCategoryName,
        isPackage,
        packageType,
        includedServices,
        validityDays,
        maxUsageCount,
        usageInterval,
        discountPercentage,
        specialBenefits,
        originalPrice,
        packagePrice,
        termsAndConditions,
        cancellationPolicy
      } = requestBody;
      
      console.log(`➕ [VENDOR-SERVICES] Adding custom service/package for vendor ${vendorId}:`, {
        serviceName,
        isPackage,
        packageType
      });
      
      // Validate service style
      if (serviceStyle !== 'at_center') {
        return c.json({ 
          error: 'Custom services can only be added for at_center service style' 
        }, 400);
      }
      
      // ✅ CRITICAL FIX: Resolve vendor ID (handles both UUID and vendor_id string)
      const vendorsRepo = getVendorsRepository();
      const resolvedVendorId = await vendorsRepo.resolveVendorId(vendorId);
      
      if (!resolvedVendorId) {
        console.error(`❌ [VENDOR-SERVICES] Vendor not found: ${vendorId}`);
        return c.json({ error: `Vendor not found: ${vendorId}` }, 404);
      }
      
      console.log(`✅ [VENDOR-SERVICES] Resolved vendor ID: ${vendorId} -> ${resolvedVendorId}`);
      
      // ✅ SQL: Validate vendor
      const vendor = await vendorsRepo.findById(resolvedVendorId);
      
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }
      
      // Validate required fields
      if (!serviceName) {
        return c.json({ error: 'Service name is required' }, 400);
      }
      
      if (!isPackage && (!price || price <= 0)) {
        return c.json({ error: 'Price is required for single services' }, 400);
      }
      
      if (isPackage && (!packagePrice || packagePrice <= 0)) {
        return c.json({ error: 'Package price is required for packages' }, 400);
      }
      
      // ✅ SQL: Create custom service
      const client = getDbClient();
      const customServiceId = `${isPackage ? 'PKG' : 'CUSTOM'}_${Date.now()}_${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      
      const customServiceData: any = {
        vendor_id: resolvedVendorId, // ✅ Use UUID, not vendor_id string
        service_style: serviceStyle,
        service_id: customServiceId,
        service_name: serviceName,
        description: description || '',
        duration: duration || 30,
        price: isPackage ? packagePrice : price,
        category_name: categoryName || 'Custom',
        sub_category_name: subCategoryName || '',
        custom_price: isPackage ? packagePrice : price,
        custom_duration: duration || 30,
        custom_description: description || '',
        is_enabled: true,
        is_new_service: true,
        is_custom_service: true,
        is_package: isPackage || false,
        publish_status: 'pending_approval',
        created_at: new Date().toISOString(),
        configured_at: new Date().toISOString(),
      };
      
      // Add package-specific fields
      if (isPackage) {
        customServiceData.package_details = {
          packageType: packageType || 'combo',
          includedServices: includedServices || [],
          validity: {
            days: validityDays || 30,
            expiresAt: null
          },
          usage: {
            maxCount: maxUsageCount || -1,
            interval: usageInterval || 'total',
            currentCount: 0
          },
          pricing: {
            originalPrice: originalPrice || 0,
            packagePrice: packagePrice || 0,
            savings: originalPrice && packagePrice ? originalPrice - packagePrice : 0,
            savingsPercent: originalPrice && packagePrice ? 
              ((originalPrice - packagePrice) / originalPrice * 100).toFixed(1) : 0
          },
          benefits: {
            discountPercentage: discountPercentage || 0,
            specialBenefits: specialBenefits || []
          },
          terms: {
            termsAndConditions: termsAndConditions || '',
            cancellationPolicy: cancellationPolicy || ''
          }
        };
      }
      
      // ✅ SQL: Insert custom service
      const { data: insertedService } = await client
        .from('vendor_services')
        .insert(customServiceData)
        .select()
        .single();
      
      // ✅ SQL: Create approval request
      await client
        .from('platform_settings')
        .upsert({
          setting_key: `custom_service_approval:${customServiceId}`,
          setting_value: {
            id: customServiceId,
            vendor_id: resolvedVendorId, // ✅ Use UUID for consistency
            vendor_id_string: vendorId, // ✅ Keep original string for reference
            vendor_name: vendor.business_name || vendor.owner_name,
            service_style: serviceStyle,
            service: customServiceData,
            submitted_at: new Date().toISOString(),
            status: 'pending'
          },
          updated_at: new Date().toISOString(),
        });
      
      console.log(`✅ [VENDOR-SERVICES] Custom service/package added: ${customServiceId}`);
      
      return c.json({
        success: true,
        message: isPackage ? 'Package created successfully and submitted for approval' : 'Custom service added successfully',
        service: insertedService
      });
      
    } catch (error) {
      console.error('❌ [VENDOR-SERVICES] Error adding custom service:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  // ============================================
  // UNPUBLISH SERVICE
  // ============================================
  /**
   * POST /make-server-3dd53475/vendor/:vendorId/services/:serviceId/unpublish
   * 
   * REFACTORED: Uses SQL repositories instead of KV
   */
  app.post("/make-server-3dd53475/vendor/:vendorId/services/:serviceId/unpublish", async (c) => {
    try {
      const { vendorId, serviceId } = c.req.param();
      
      console.log(`📴 [VENDOR-SERVICES] Unpublishing service ${serviceId} for vendor ${vendorId}`);
      
      // ✅ CRITICAL FIX: Resolve vendor ID (handles both UUID and vendor_id string)
      const vendorsRepo = getVendorsRepository();
      const resolvedVendorId = await vendorsRepo.resolveVendorId(vendorId);
      
      if (!resolvedVendorId) {
        console.error(`❌ [VENDOR-SERVICES] Vendor not found: ${vendorId}`);
        return c.json({ error: `Vendor not found: ${vendorId}` }, 404);
      }
      
      console.log(`✅ [VENDOR-SERVICES] Resolved vendor ID: ${vendorId} -> ${resolvedVendorId}`);
      
      // ✅ SQL: Find and update service
      // ✅ CRITICAL FIX: Use resolved vendor ID (UUID) not the original string
      const client = getDbClient();
      const { data: service } = await client
        .from('vendor_services')
        .select('*')
        .eq('vendor_id', resolvedVendorId) // ✅ Use UUID, not vendor_id string
        .eq('service_id', serviceId)
        .maybeSingle();
      
      if (!service) {
        return c.json({ error: 'Service not found' }, 404);
      }
      
      // ✅ SQL: Update service status to draft
      await client
        .from('vendor_services')
        .update({
          publish_status: 'draft',
          unpublished_at: new Date().toISOString(),
          published_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', service.id);
      
      console.log(`✅ [VENDOR-SERVICES] Service ${serviceId} unpublished successfully`);
      
      return c.json({
        success: true,
        message: 'Service unpublished successfully'
      });
      
    } catch (error) {
      console.error('❌ [VENDOR-SERVICES] Error unpublishing service:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  // ============================================
  // DELETE SERVICE (CUSTOM SERVICES ONLY)
  // ============================================
  /**
   * DELETE /make-server-3dd53475/vendor/:vendorId/services/:serviceId
   * 
   * REFACTORED: Uses SQL repositories instead of KV
   */
  app.delete("/make-server-3dd53475/vendor/:vendorId/services/:serviceId", async (c) => {
    try {
      const { vendorId, serviceId } = c.req.param();
      
      console.log(`🗑️ [VENDOR-SERVICES] Deleting service ${serviceId} for vendor ${vendorId}`);
      
      // ✅ CRITICAL FIX: Resolve vendor ID (handles both UUID and vendor_id string)
      const vendorsRepo = getVendorsRepository();
      const resolvedVendorId = await vendorsRepo.resolveVendorId(vendorId);
      
      if (!resolvedVendorId) {
        console.error(`❌ [VENDOR-SERVICES] Vendor not found: ${vendorId}`);
        return c.json({ error: `Vendor not found: ${vendorId}` }, 404);
      }
      
      console.log(`✅ [VENDOR-SERVICES] Resolved vendor ID: ${vendorId} -> ${resolvedVendorId}`);
      
      // ✅ SQL: Find service
      // ✅ CRITICAL FIX: Use resolved vendor ID (UUID) not the original string
      const client = getDbClient();
      const { data: service } = await client
        .from('vendor_services')
        .select('*')
        .eq('vendor_id', resolvedVendorId) // ✅ Use UUID, not vendor_id string
        .eq('service_id', serviceId)
        .maybeSingle();
      
      if (!service) {
        return c.json({ error: 'Service not found' }, 404);
      }
      
      // Only allow deletion of custom services
      if (!service.is_custom_service) {
        return c.json({ 
          error: 'Cannot delete platform services. You can only disable them.' 
        }, 400);
      }
      
      // Only allow deletion if not published
      if (service.publish_status === 'published') {
        return c.json({ 
          error: 'Cannot delete published services. Please unpublish first.' 
        }, 400);
      }
      
      // ✅ SQL: Delete service
      await client
        .from('vendor_services')
        .delete()
        .eq('id', service.id);
      
      console.log(`✅ [VENDOR-SERVICES] Service ${serviceId} deleted successfully`);
      
      return c.json({
        success: true,
        message: 'Service deleted successfully'
      });
      
    } catch (error) {
      console.error('❌ [VENDOR-SERVICES] Error deleting service:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  // ============================================
  // GET PENDING APPROVAL REQUESTS (Admin)
  // ============================================
  /**
   * GET /make-server-3dd53475/admin/rate-change-requests
   * 
   * REFACTORED: Uses SQL repositories instead of KV
   */
  app.get("/make-server-3dd53475/admin/rate-change-requests", async (c) => {
    try {
      console.log(`📋 [ADMIN] Fetching pending rate change requests`);
      
      // ✅ SQL: Get all rate change requests from platform_settings
      const client = getDbClient();
      const { data: requestSettings } = await client
        .from('platform_settings')
        .select('*')
        .like('setting_key', 'rate_change_request:%');
      
      const allRequests = requestSettings?.map((rs: any) => rs.setting_value) || [];
      
      // Filter pending requests and sort by date
      const pendingRequests = allRequests
        .filter((req: any) => req.status === 'pending')
        .sort((a: any, b: any) => 
          new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
        );
      
      console.log(`✅ [ADMIN] Found ${pendingRequests.length} pending requests`);
      
      return c.json({
        success: true,
        requests: pendingRequests,
        totalCount: pendingRequests.length
      });
      
    } catch (error) {
      console.error('❌ [ADMIN] Error fetching rate change requests:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  // ============================================
  // APPROVE/REJECT RATE CHANGE REQUEST (Admin)
  // ============================================
  /**
   * POST /make-server-3dd53475/admin/rate-change-requests/:requestId/decide
   * 
   * REFACTORED: Uses SQL repositories instead of KV
   */
  app.post("/make-server-3dd53475/admin/rate-change-requests/:requestId/decide", async (c) => {
    try {
      const { requestId } = c.req.param();
      const { action, rejectionReason, adminNotes } = await c.req.json();
      
      console.log(`🔍 [ADMIN] Processing rate change request: ${requestId}, action: ${action}`);
      
      // ✅ SQL: Get request
      const client = getDbClient();
      const { data: requestSetting } = await client
        .from('platform_settings')
        .select('*')
        .eq('setting_key', `rate_change_request:${requestId}`)
        .maybeSingle();
      
      const request = requestSetting?.setting_value;
      
      if (!request) {
        return c.json({ error: 'Request not found' }, 404);
      }
      
      if (request.status !== 'pending') {
        return c.json({ error: 'Request already processed' }, 400);
      }
      
      if (action === 'approve') {
        // ✅ SQL: Approve and publish services
        const { data: vendorServices } = await client
          .from('vendor_services')
          .select('*')
          .eq('vendor_id', request.vendor_id)
          .eq('service_style', request.service_style);
        
        if (vendorServices) {
          for (const service of vendorServices) {
            if (service.approval_request_id === requestId) {
              await client
                .from('vendor_services')
                .update({
                  publish_status: 'published',
                  published_at: new Date().toISOString(),
                  approved_by: 'admin',
                  approval_request_id: null,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', service.id);
            }
          }
        }
        
        // ✅ SQL: Update request
        await client
          .from('platform_settings')
          .update({
            setting_value: {
              ...request,
              status: 'approved',
              approved_at: new Date().toISOString(),
              admin_notes: adminNotes,
            },
            updated_at: new Date().toISOString(),
          })
          .eq('setting_key', `rate_change_request:${requestId}`);
        
        console.log(`✅ [ADMIN] Request approved: ${requestId}`);
        
        // ✅ SQL: Send notification to vendor
        await getNotificationsRepository().create({
          recipient_type: 'vendor',
          recipient_id: request.vendor_id,
          notification_type: 'rate_change_approved',
          title: 'Services Approved',
          message: `Your ${request.services.length} service(s) have been approved and are now live for customers`,
          channels: { email: true, sms: false, inApp: true, push: false },
          data: { requestId },
        });
        
        return c.json({
          success: true,
          message: 'Services approved and published successfully',
          status: 'approved'
        });
        
      } else if (action === 'reject') {
        if (!rejectionReason) {
          return c.json({ error: 'Rejection reason is required' }, 400);
        }
        
        // ✅ SQL: Update vendor services status
        const { data: vendorServices } = await client
          .from('vendor_services')
          .select('*')
          .eq('vendor_id', request.vendor_id)
          .eq('service_style', request.service_style);
        
        if (vendorServices) {
          for (const service of vendorServices) {
            if (service.approval_request_id === requestId) {
              await client
                .from('vendor_services')
                .update({
                  publish_status: 'rejected',
                  rejection_reason: rejectionReason,
                  approval_request_id: null,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', service.id);
            }
          }
        }
        
        // ✅ SQL: Update request
        await client
          .from('platform_settings')
          .update({
            setting_value: {
              ...request,
              status: 'rejected',
              rejected_at: new Date().toISOString(),
              rejection_reason: rejectionReason,
              admin_notes: adminNotes,
            },
            updated_at: new Date().toISOString(),
          })
          .eq('setting_key', `rate_change_request:${requestId}`);
        
        console.log(`❌ [ADMIN] Request rejected: ${requestId}`);
        
        // ✅ SQL: Send notification to vendor
        await getNotificationsRepository().create({
          recipient_type: 'vendor',
          recipient_id: request.vendor_id,
          notification_type: 'rate_change_rejected',
          title: 'Services Rejected',
          message: `Your service submission was rejected. Reason: ${rejectionReason}`,
          channels: { email: true, sms: false, inApp: true, push: false },
          data: { requestId, rejectionReason },
        });
        
        return c.json({
          success: true,
          message: 'Request rejected and vendor notified',
          status: 'rejected'
        });
        
      } else {
        return c.json({ error: 'Invalid action' }, 400);
      }
      
    } catch (error) {
      console.error('❌ [ADMIN] Error processing rate change request:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  // ============================================
  // GET VENDOR NOTIFICATIONS
  // ============================================
  /**
   * GET /make-server-3dd53475/vendor/:vendorId/notifications
   * 
   * REFACTORED: Uses SQL repositories instead of KV
   */
  app.get("/make-server-3dd53475/vendor/:vendorId/notifications", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      console.log(`📬 [VENDOR-NOTIFICATIONS] Fetching notifications for vendor ${vendorId}`);
      
      // ✅ SQL: Get notifications for vendor
      const notifications = await getNotificationsRepository().findByRecipient(
        'vendor',
        vendorId,
        { limit: 100 }
      );
      
      // Sort by date (newest first)
      notifications.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      return c.json({
        success: true,
        notifications: notifications.map(n => ({
          id: n.id,
          type: n.notification_type,
          title: n.title,
          message: n.message,
          metadata: n.data,
          isRead: n.is_read,
          createdAt: n.created_at
        })),
        unreadCount: notifications.filter(n => !n.is_read).length
      });
      
    } catch (error) {
      console.error('❌ [VENDOR-NOTIFICATIONS] Error fetching notifications:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  console.log('✅ Vendor service management routes registered (SQL-only)');
}

