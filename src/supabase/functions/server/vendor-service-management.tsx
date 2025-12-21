import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';

export function registerVendorServiceManagementRoutes(app: Hono) {
  
  // ============================================
  // DEBUG: CHECK CATALOG STATUS
  // ============================================
  app.get("/make-server-3dd53475/vendor/debug/catalog-status", async (c) => {
    try {
      const catalogData = await kv.get('platform:service_catalog');
      const catalog = catalogData || [];
      
      const categoryMappings = await kv.getByPrefix('service_category_mapping:');
      
      return c.json({
        success: true,
        catalogCount: catalog.length,
        sampleServices: catalog.slice(0, 5),
        breakdown: {
          at_home: catalog.filter((s: any) => s.serviceStyle === 'at_home').length,
          at_center: catalog.filter((s: any) => s.serviceStyle === 'at_center').length,
          tele: catalog.filter((s: any) => s.serviceStyle === 'tele').length
        },
        categoryMappings: categoryMappings.map((cm: any) => ({
          vendorType: cm.vendorType,
          categories: cm.categories
        }))
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
   * This is the NEW endpoint that uses roleId from role configuration
   */
  app.get("/make-server-3dd53475/vendor/:vendorId/services/:serviceStyle", async (c) => {
    try {
      const { vendorId, serviceStyle } = c.req.param();
      
      console.log(`📋 [VENDOR-SERVICES-V2] Fetching available services for vendor ${vendorId}, style: ${serviceStyle}`);
      
      // 1. Get vendor profile to determine roleId
      const vendorKey = `vendor:${vendorId}`;
      const vendor = await kv.get(vendorKey);
      
      if (!vendor) {
        console.error(`❌ [VENDOR-SERVICES-V2] Vendor not found: ${vendorId}`);
        return c.json({ error: 'Vendor not found' }, 404);
      }
      
      const roleId = vendor.roleId;
      const vendorServiceStyle = vendor.serviceStyle;
      
      console.log(`🏷️ [VENDOR-SERVICES-V2] Vendor roleId: ${roleId}, registered serviceStyle: ${vendorServiceStyle}`);
      
      // 2. Get role configuration to check allowed service styles
      const roleConfigKey = `role:config:${roleId}`;
      const roleConfig = await kv.get(roleConfigKey);
      
      if (!roleConfig) {
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
      
      // 4. Get all services from catalog
      const catalogData = await kv.get('platform:service_catalog');
      const allServices = catalogData || [];
      console.log(`📚 [VENDOR-SERVICES-V2] Total catalog services: ${allServices.length}`);
      
      // Debug: Log first 3 services to see structure
      if (allServices.length > 0) {
        console.log('🔍 [DEBUG-V2] Sample services from catalog:');
        allServices.slice(0, 3).forEach((s: any, idx: number) => {
          console.log(`   Service ${idx + 1}:`, {
            name: s.serviceName || s.name,
            category: s.categoryName,
            style: s.serviceStyle,
            applicableRoles: s.applicableRoles
          });
        });
      }
      
      // 5. Filter services by:
      //    - applicableRoles includes vendor's roleId
      //    - serviceStyle matches requested style
      console.log(`🎯 [DEBUG-V2] Filtering for roleId: ${roleId}, serviceStyle: ${serviceStyle}`);
      
      const availableServices = allServices.filter((service: any) => {
        // Check if this service is applicable to this role
        const applicableRoles = service.applicableRoles || [];
        const matchesRole = applicableRoles.includes(roleId);
        
        // Handle both serviceStyle (singular) and serviceStyles (plural array)
        const serviceStyleValue = service.serviceStyle || service.serviceStyles;
        let matchesStyle = false;
        
        if (Array.isArray(serviceStyleValue)) {
          matchesStyle = serviceStyleValue.includes(serviceStyle);
        } else if (serviceStyleValue) {
          matchesStyle = serviceStyleValue === serviceStyle;
        }
        
        const isActive = service.isActive !== false;
        
        console.log(`🔍 [FILTER-V2] Service: ${service.serviceName}, Roles: ${JSON.stringify(applicableRoles)}, Style: ${serviceStyleValue}, MatchesRole: ${matchesRole}, MatchesStyle: ${matchesStyle}`);
        
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
        // Additional catalog details
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
      
      // Get vendor's already configured services for this style
      const vendorServicesKey = `vendor_services:${vendorId}:${serviceStyle}`;
      const vendorServices = await kv.get(vendorServicesKey) || { services: [] };
      
      console.log(`📦 [VENDOR-SERVICES-V2] Vendor has ${vendorServices.services.length} configured services`);
      
      // Mark which catalog services are already enabled
      const catalogServicesWithStatus = availableServices.map((service: any) => {
        const vendorService = vendorServices.services.find((vs: any) => vs.serviceId === service.id);
        return {
          ...service,
          isEnabled: vendorService?.isEnabled || false,
          customPrice: vendorService?.customPrice,
          customDuration: vendorService?.customDuration,
          customDescription: vendorService?.customDescription,
          publishStatus: vendorService?.publishStatus || 'draft',
          isCustomService: false
        };
      });
      
      // Get custom services (services not in catalog)
      const customServices = vendorServices.services
        .filter((vs: any) => vs.isCustomService === true)
        .map((vs: any) => ({
          id: vs.serviceId,
          name: vs.serviceName,
          description: vs.customDescription || vs.description || '',
          categoryName: vs.categoryName || 'Custom',
          subCategoryName: vs.subCategoryName || '',
          duration: vs.customDuration || vs.duration || 30,
          price: vs.customPrice || 0,
          isPlatformManaged: false,
          isPackage: false,
          packageDetails: null,
          whatIncluded: [],
          whatNotIncluded: [],
          requirements: [],
          petTypes: [],
          applicableRoles: [roleId],
          icon: '⭐',
          isEnabled: vs.isEnabled || true,
          customPrice: vs.customPrice,
          customDuration: vs.customDuration,
          customDescription: vs.customDescription,
          publishStatus: vs.publishStatus || 'draft',
          isCustomService: true
        }));
      
      console.log(`⭐ [VENDOR-SERVICES-V2] Found ${customServices.length} custom services`);
      
      // Combine catalog services and custom services
      const combinedServices = [...catalogServicesWithStatus, ...customServices];
      
      console.log(`✅ [VENDOR-SERVICES-V2] Returning ${combinedServices.length} total services (${catalogServicesWithStatus.length} catalog + ${customServices.length} custom)`);
      
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
      return c.json({ error: String(error) }, 500);;
    }
  });
  
  // ============================================
  // GET AVAILABLE SERVICES FOR VENDOR (LEGACY - Uses vendorType)
  // ============================================
  // Fetches services from catalog filtered by vendor type and service style
  /**
   * GET /vendor/:vendorId/available-services/:serviceStyle
   * Get available services with fallback to defaults if catalog is empty
   * ✅ FIX: Service Catalog Dependency - Provides fallback services
   */
  app.get("/make-server-3dd53475/vendor/:vendorId/available-services/:serviceStyle", async (c) => {
    try {
      const { vendorId, serviceStyle } = c.req.param();
      
      console.log(`📋 [VENDOR-SERVICES] Fetching available services for vendor ${vendorId}, style: ${serviceStyle}`);
      
      // Get vendor profile to determine vendor type
      const vendorKey = `vendor:${vendorId}`;
      const vendor = await kv.get(vendorKey);
      
      if (!vendor) {
        console.error(`❌ [VENDOR-SERVICES] Vendor not found: ${vendorId}`);
        return c.json({ error: 'Vendor not found' }, 404);
      }
      
      const vendorType = vendor.vendorType;
      console.log(`🏷️ [VENDOR-SERVICES] Vendor type: ${vendorType}`);
      
      // Get service category mapping for this vendor type
      const categoryMappingKey = `service_category_mapping:${vendorType}`;
      const categoryMapping = await kv.get(categoryMappingKey);
      
      if (!categoryMapping || !categoryMapping.categories || categoryMapping.categories.length === 0) {
        console.log(`⚠️ [VENDOR-SERVICES] No category mapping found for vendor type: ${vendorType}`);
        return c.json({ 
          services: [],
          message: 'No services configured for this vendor type'
        });
      }
      
      console.log(`📂 [VENDOR-SERVICES] Categories for ${vendorType}:`, categoryMapping.categories);
      
      // Get all services from catalog
      const catalogData = await kv.get('platform:service_catalog');
      const allServices = catalogData || [];
      console.log(`📚 [VENDOR-SERVICES] Total catalog services: ${allServices.length}`);
      
      // Debug: Log first 3 services to see structure
      if (allServices.length > 0) {
        console.log('🔍 [DEBUG] Sample services from catalog:');
        allServices.slice(0, 3).forEach((s: any, idx: number) => {
          console.log(`   Service ${idx + 1}:`, {
            name: s.serviceName || s.name,
            category: s.categoryName,
            style: s.serviceStyle,
            applicableRoles: s.applicableRoles
          });
        });
      }
      
      // Debug: Show what we're filtering for
      console.log(`🎯 [DEBUG] Looking for:`, {
        serviceStyle: serviceStyle,
        categories: categoryMapping.categories,
        vendorType: vendorType
      });
      
      // Filter services by:
      // 1. Service categories that match vendor type
      // 2. Service style (at_home, at_center, tele)
      const availableServices = allServices.filter((service: any) => {
        // Check category match
        const serviceCategoryName = service.categoryName || service.category;
        const matchesCategory = categoryMapping.categories.some((cat: string) => 
          serviceCategoryName?.toLowerCase() === cat.toLowerCase()
        );
        
        // Handle both serviceStyle (singular) and serviceStyles (plural array)
        const serviceStyleValue = service.serviceStyle || service.serviceStyles;
        let matchesStyle = false;
        
        if (Array.isArray(serviceStyleValue)) {
          matchesStyle = serviceStyleValue.includes(serviceStyle);
        } else if (serviceStyleValue) {
          matchesStyle = serviceStyleValue === serviceStyle;
        }
        
        const isActive = service.isActive !== false;
        
        console.log(`🔍 [FILTER] Service: ${service.serviceName}, Category: ${serviceCategoryName}, Style: ${serviceStyleValue}, MatchesCat: ${matchesCategory}, MatchesStyle: ${matchesStyle}`);
        
        return matchesCategory && matchesStyle && isActive;
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
        // Additional catalog details
        isPackage: service.isPackage || false,
        packageDetails: service.packageDetails,
        whatIncluded: service.whatIncluded || service.includes || [],
        whatNotIncluded: service.whatNotIncluded || service.excludes || [],
        requirements: service.requirements || [],
        petTypes: service.petTypes || service.applicableRoles || [],
        icon: service.icon || '🔧'
      }));
      
      console.log(`✅ [VENDOR-SERVICES] Found ${availableServices.length} matching services`);
      
      // ✅ FIX: If catalog is empty, provide fallback services
      let servicesWithStatus = availableServices;
      
      if (availableServices.length === 0) {
        console.log(`⚠️ [VENDOR-SERVICES] Catalog is empty, providing fallback services`);
        
        // Get vendor role for fallback services
        const roleId = vendor.roleId || 'veterinarian';
        
        // Fetch default services
        try {
          const defaultServicesResponse = await fetch(
            `${Deno.env.get('SUPABASE_URL')}/functions/v1/make-server-3dd53475/vendor/${vendorId}/default-services/${roleId}?serviceStyle=${serviceStyle}`,
            {
              headers: {
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
              }
            }
          );
          
          if (defaultServicesResponse.ok) {
            const defaultData = await defaultServicesResponse.json();
            servicesWithStatus = defaultData.services || [];
            console.log(`✅ [VENDOR-SERVICES] Loaded ${servicesWithStatus.length} default services`);
          }
        } catch (fallbackError) {
          console.error('Error loading fallback services:', fallbackError);
        }
      }
      
      // Get vendor's already configured services for this style
      const vendorServicesKey = `vendor_services:${vendorId}:${serviceStyle}`;
      const vendorServices = await kv.get(vendorServicesKey) || { services: [] };
      
      // Mark which services are already enabled
      servicesWithStatus = servicesWithStatus.map((service: any) => {
        const vendorService = vendorServices.services.find((vs: any) => vs.serviceId === service.id);
        return {
          ...service,
          isEnabled: vendorService?.isEnabled || false,
          customPrice: vendorService?.customPrice,
          customDuration: vendorService?.customDuration,
          publishStatus: vendorService?.publishStatus || 'draft',
          isDefaultService: service.isDefaultService || false
        };
      });
      
      return c.json({
        success: true,
        vendorType,
        serviceStyle,
        services: servicesWithStatus,
        isPlatformManaged: serviceStyle === 'at_home' || serviceStyle === 'tele',
        isUsingDefaults: availableServices.length === 0 && servicesWithStatus.length > 0,
        message: availableServices.length === 0 ? 'Using default services. Please configure catalog in admin panel.' : undefined
      });
      
    } catch (error) {
      console.error('❌ [VENDOR-SERVICES] Error fetching available services:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  // ============================================
  // GET VENDOR'S CONFIGURED SERVICES
  // ============================================
  app.get("/make-server-3dd53475/vendor/:vendorId/services", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      console.log(`📋 [VENDOR-SERVICES] Fetching configured services for vendor ${vendorId}`);
      
      // Get vendor profile
      const vendorKey = `vendor:${vendorId}`;
      const vendor = await kv.get(vendorKey);
      
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }
      
      // Get all service styles configured for this vendor
      const serviceStyles = ['at_home', 'at_center', 'tele'];
      const allVendorServices: any = {
        at_home: { services: [], publishedCount: 0 },
        at_center: { services: [], publishedCount: 0 },
        tele: { services: [], publishedCount: 0 }
      };
      
      for (const style of serviceStyles) {
        const vendorServicesKey = `vendor_services:${vendorId}:${style}`;
        const vendorServices = await kv.get(vendorServicesKey);
        
        if (vendorServices && vendorServices.services) {
          allVendorServices[style] = {
            services: vendorServices.services,
            publishedCount: vendorServices.services.filter((s: any) => s.publishStatus === 'published').length
          };
        }
      }
      
      return c.json({
        success: true,
        vendorId,
        vendorType: vendor.vendorType,
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
  app.post("/make-server-3dd53475/vendor/:vendorId/services/configure", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const { serviceStyle, services } = await c.req.json();
      
      console.log(`🔧 [VENDOR-SERVICES] Configuring services for vendor ${vendorId}, style: ${serviceStyle}`);
      console.log(`📊 [VENDOR-SERVICES] Number of services: ${services.length}`);
      
      // Validate vendor exists
      const vendorKey = `vendor:${vendorId}`;
      const vendor = await kv.get(vendorKey);
      
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
          // For at_center, validate pricing (either customPrice or default price must exist)
          if (service.isEnabled) {
            const hasValidPrice = (service.customPrice && service.customPrice > 0) || (service.price && service.price > 0);
            if (!hasValidPrice) {
              return c.json({ 
                error: `Price is required for service: ${service.serviceName}` 
              }, 400);
            }
            // If no custom price set but has default price, use the default price as custom price
            if (!service.customPrice && service.price) {
              service.customPrice = service.price;
            }
          }
        }
      }
      
      // Save vendor service configuration
      const vendorServicesKey = `vendor_services:${vendorId}:${serviceStyle}`;
      
      // Get existing vendor services to preserve custom services
      const existingVendorServices = await kv.get(vendorServicesKey) || { services: [] };
      
      const vendorServicesData = {
        vendorId,
        serviceStyle,
        isPlatformManaged,
        services: services.map((s: any) => {
          // Check if this is an existing custom service
          const existingService = existingVendorServices.services?.find((es: any) => es.serviceId === s.serviceId);
          
          // ✅ FIXED: Auto-publish catalog services, keep custom services as draft
          const isCustomService = existingService?.isCustomService || s.isNewService || false;
          const publishStatus = isCustomService ? 'draft' : 'published'; // Auto-publish catalog services
          
          return {
            serviceId: s.serviceId,
            serviceName: s.serviceName,
            isEnabled: s.isEnabled,
            customPrice: s.customPrice,
            customDuration: s.customDuration,
            customDescription: s.customDescription,
            publishStatus: publishStatus, // ✅ Auto-publish catalog services
            publishedAt: !isCustomService ? new Date().toISOString() : undefined, // Add timestamp for published services
            approvalStatus: !isCustomService ? 'auto_approved' : undefined, // Mark catalog services as auto-approved
            configuredAt: new Date().toISOString(),
            // Preserve custom service flags
            isCustomService: isCustomService,
            isNewService: s.isNewService || false,
            categoryName: existingService?.categoryName || s.categoryName,
            subCategoryName: existingService?.subCategoryName || s.subCategoryName,
            description: existingService?.description || s.description
          };
        }),
        lastUpdated: new Date().toISOString()
      };
      
      await kv.set(vendorServicesKey, vendorServicesData);
      
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
  app.post("/make-server-3dd53475/vendor/:vendorId/services/publish", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const { serviceStyle } = await c.req.json();
      
      console.log(`🚀 [VENDOR-SERVICES] Publishing services for vendor ${vendorId}, style: ${serviceStyle}`);
      
      // Get vendor
      const vendorKey = `vendor:${vendorId}`;
      const vendor = await kv.get(vendorKey);
      
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }
      
      // ✅ FIX #1: Smart staff requirement check (solo vs center-based)
      const vendorStaffList = await kv.get(`vendor:${vendorId}:staff`) || [];
      
      // Check if vendor is solo provider
      const isSoloProvider = vendor.isSoloProvider || 
                            vendor.vendorType === 'service_provider' ||
                            ['pet_walker', 'nutritionist', 'pet_sitter', 'pet_trainer'].includes(vendor.roleId);
      
      // Check if vendor is center-based
      const isCenterBased = vendor.vendorType === 'healthcare_provider' ||
                           vendor.serviceStyle === 'at_center' ||
                           ['veterinary_clinic', 'pet_boarding', 'pet_resort', 'pet_cafe'].includes(vendor.roleId);
      
      // Solo providers can publish without staff (they ARE the staff)
      if (isSoloProvider && vendorStaffList.length === 0) {
        // Auto-create staff profile for solo vendor
        const staffId = `${vendorId}_staff_self`;
        const soloStaff = {
          id: staffId,
          vendorId,
          fullName: vendor.fullName || vendor.businessName,
          phone: vendor.phone,
          email: vendor.email,
          role: vendor.roleId,
          roleType: vendor.roleId,
          isSoloProvider: true,
          isActive: true,
          isOnline: true,
          services: [],
          availability: vendor.availability || {},
          createdAt: new Date().toISOString()
        };

        await kv.set(`staff:${staffId}`, soloStaff);
        await kv.set(`vendor:${vendorId}:staff`, [staffId]);

        console.log(`✅ Auto-created staff profile for solo vendor: ${vendorId}`);
      }
      
      // Center-based vendors still need staff
      if (isCenterBased && vendorStaffList.length === 0) {
        console.error(`❌ [VENDOR-SERVICES] Cannot publish: Center-based vendor ${vendorId} has no staff members`);
        return c.json({ 
          error: 'Cannot publish services without staff',
          message: 'Center-based vendors must have at least one staff member before publishing services.',
          requiresStaff: true,
          isCenterBased: true
        }, 400);
      }
      
      console.log(`✅ [VENDOR-SERVICES] Vendor has ${vendorStaffList.length} staff member(s)`);
      
      // Get vendor services
      const vendorServicesKey = `vendor_services:${vendorId}:${serviceStyle}`;
      const vendorServices = await kv.get(vendorServicesKey);
      
      if (!vendorServices || !vendorServices.services || vendorServices.services.length === 0) {
        return c.json({ error: 'No services configured' }, 400);
      }
      
      const enabledServices = vendorServices.services.filter((s: any) => s.isEnabled);
      
      if (enabledServices.length === 0) {
        return c.json({ error: 'No services enabled' }, 400);
      }
      
      // ============================================
      // CRITICAL BUSINESS LOGIC: Auto-Approve vs Manual Approval
      // ============================================
      // UPDATED LOGIC:
      // 1. Platform catalog services (at_home, tele) → Auto-approve to "published"
      // 2. Platform catalog services (at_center) → Auto-approve to "published" 
      // 3. ONLY custom/new services created by vendor → Require admin approval
      // ============================================
      
      const customServices = enabledServices.filter((s: any) => 
        s.isCustomService || s.isNewService
      );
      
      const catalogServices = enabledServices.filter((s: any) => 
        !s.isCustomService && !s.isNewService
      );
      
      console.log(`📊 [VENDOR-SERVICES] Service breakdown:`);
      console.log(`   ✅ Platform catalog services (auto-approve): ${catalogServices.length}`);
      console.log(`   📋 Custom/new services (require approval): ${customServices.length}`);
      
      const isPlatformManaged = serviceStyle === 'at_home' || serviceStyle === 'tele';
      
      // AUTO-APPROVE: All catalog services (regardless of style)
      if (catalogServices.length > 0) {
        catalogServices.forEach((service: any) => {
          const serviceInVendorList = vendorServices.services.find((s: any) => s.serviceId === service.serviceId);
          if (serviceInVendorList) {
            serviceInVendorList.publishStatus = 'published';
            serviceInVendorList.publishedAt = new Date().toISOString();
            serviceInVendorList.approvalStatus = 'auto_approved';
          }
        });
        console.log(`✅ [AUTO-APPROVE] ${catalogServices.length} catalog services set to "published" immediately`);
      }
      
      // ONLY custom services need approval (all styles)
      if (customServices.length > 0) {
        const requestId = `RATE_REQ_${Date.now()}`;
        const approvalRequest = {
          id: requestId,
          vendorId,
          vendorName: vendor.fullName || vendor.businessName,
          businessName: vendor.businessName,
          vendorType: vendor.vendorType,
          serviceStyle,
          services: customServices.map((s: any) => ({
            serviceId: s.serviceId,
            serviceName: s.serviceName,
            customPrice: s.customPrice,
            customDuration: s.customDuration,
            customDescription: s.customDescription,
            isCustomService: s.isCustomService || false,
            isNewService: s.isNewService || false,
            categoryName: s.categoryName,
            subCategoryName: s.subCategoryName,
            description: s.description,
            isPackage: s.isPackage || false,
            packageDetails: s.packageDetails
          })),
          status: 'pending',
          requestType: 'custom_service_approval',
          submittedAt: new Date().toISOString(),
          metadata: {
            totalServices: customServices.length,
            customServices: customServices.length,
            newServices: customServices.filter((s: any) => s.isNewService).length
          }
        };
        
        await kv.set(`rate_change_request:${requestId}`, approvalRequest);
        
        // Mark custom services as pending approval
        customServices.forEach((service: any) => {
          const serviceInVendorList = vendorServices.services.find((s: any) => s.serviceId === service.serviceId);
          if (serviceInVendorList) {
            serviceInVendorList.publishStatus = 'pending_approval';
            serviceInVendorList.approvalRequestId = requestId;
          }
        });
        
        console.log(`📋 [REQUIRE-APPROVAL] Created approval request: ${requestId} for ${customServices.length} custom services`);
      }
      
      vendorServices.lastPublished = new Date().toISOString();
      await kv.set(vendorServicesKey, vendorServices);
      
      // Determine response based on what happened
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
        // Enhanced package fields
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
      
      // Validate vendor
      const vendorKey = `vendor:${vendorId}`;
      const vendor = await kv.get(vendorKey);
      
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
      
      // Get or create vendor services
      const vendorServicesKey = `vendor_services:${vendorId}:${serviceStyle}`;
      let vendorServices = await kv.get(vendorServicesKey);
      
      if (!vendorServices) {
        vendorServices = {
          vendorId,
          serviceStyle,
          isPlatformManaged: false,
          services: [],
          lastUpdated: new Date().toISOString()
        };
      }
      
      // Create custom service ID
      const customServiceId = `${isPackage ? 'PKG' : 'CUSTOM'}_${vendorId}_${Date.now()}`;
      
      // Build custom service/package object
      const customService: any = {
        id: customServiceId,
        serviceId: customServiceId,
        name: serviceName,
        serviceName,
        description: description || '',
        duration: duration || 30,
        price: isPackage ? packagePrice : price,
        categoryName: categoryName || 'Custom',
        subCategoryName: subCategoryName || '',
        customPrice: isPackage ? packagePrice : price,
        customDuration: duration || 30,
        customDescription: description || '',
        isEnabled: true,
        isNewService: true,
        isCustomService: true,
        isPackage: isPackage || false,
        publishStatus: 'pending_approval', // Packages always require approval
        createdAt: new Date().toISOString(),
        configuredAt: new Date().toISOString()
      };
      
      // Add package-specific fields
      if (isPackage) {
        customService.packageDetails = {
          packageType: packageType || 'combo',
          includedServices: includedServices || [],
          validity: {
            days: validityDays || 30,
            expiresAt: null // Set when purchased
          },
          usage: {
            maxCount: maxUsageCount || -1, // -1 for unlimited
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
        
        // Create what's included list for display
        customService.whatIncluded = includedServices?.map((s: any) => s.name) || [];
      }
      
      vendorServices.services.push(customService);
      vendorServices.lastUpdated = new Date().toISOString();
      
      await kv.set(vendorServicesKey, vendorServices);
      
      // Also save to pending approvals if it's a package or custom service
      const approvalKey = `custom_service_approval:${customServiceId}`;
      await kv.set(approvalKey, {
        id: customServiceId,
        vendorId,
        vendorName: vendor.businessName || vendor.fullName,
        serviceStyle,
        service: customService,
        submittedAt: new Date().toISOString(),
        status: 'pending'
      });
      
      console.log(`✅ [VENDOR-SERVICES] Custom service/package added: ${customServiceId}`);
      
      return c.json({
        success: true,
        message: isPackage ? 'Package created successfully and submitted for approval' : 'Custom service added successfully',
        service: customService
      });
      
    } catch (error) {
      console.error('❌ [VENDOR-SERVICES] Error adding custom service:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  // ============================================
  // UNPUBLISH SERVICE
  // ============================================
  app.post("/make-server-3dd53475/vendor/:vendorId/services/:serviceId/unpublish", async (c) => {
    try {
      const { vendorId, serviceId } = c.req.param();
      
      console.log(`📴 [VENDOR-SERVICES] Unpublishing service ${serviceId} for vendor ${vendorId}`);
      
      // Find the service across all service styles
      const serviceStyles = ['at_home', 'at_center', 'tele'];
      let found = false;
      
      for (const style of serviceStyles) {
        const vendorServicesKey = `vendor_services:${vendorId}:${style}`;
        const vendorServices = await kv.get(vendorServicesKey);
        
        if (vendorServices && vendorServices.services) {
          const serviceIndex = vendorServices.services.findIndex((s: any) => s.serviceId === serviceId);
          
          if (serviceIndex !== -1) {
            // Update service status to draft
            vendorServices.services[serviceIndex].publishStatus = 'draft';
            vendorServices.services[serviceIndex].unpublishedAt = new Date().toISOString();
            delete vendorServices.services[serviceIndex].publishedAt;
            
            await kv.set(vendorServicesKey, vendorServices);
            console.log(`✅ [VENDOR-SERVICES] Service ${serviceId} unpublished successfully`);
            found = true;
            break;
          }
        }
      }
      
      if (!found) {
        return c.json({ error: 'Service not found' }, 404);
      }
      
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
  app.delete("/make-server-3dd53475/vendor/:vendorId/services/:serviceId", async (c) => {
    try {
      const { vendorId, serviceId } = c.req.param();
      
      console.log(`🗑️ [VENDOR-SERVICES] Deleting service ${serviceId} for vendor ${vendorId}`);
      
      // Find the service across all service styles
      const serviceStyles = ['at_home', 'at_center', 'tele'];
      let found = false;
      let isCustomService = false;
      
      for (const style of serviceStyles) {
        const vendorServicesKey = `vendor_services:${vendorId}:${style}`;
        const vendorServices = await kv.get(vendorServicesKey);
        
        if (vendorServices && vendorServices.services) {
          const serviceIndex = vendorServices.services.findIndex((s: any) => s.serviceId === serviceId);
          
          if (serviceIndex !== -1) {
            const service = vendorServices.services[serviceIndex];
            
            // Only allow deletion of custom services
            if (!service.isCustomService) {
              return c.json({ 
                error: 'Cannot delete platform services. You can only disable them.' 
              }, 400);
            }
            
            // Only allow deletion if not published or if draft/rejected
            if (service.publishStatus === 'published') {
              return c.json({ 
                error: 'Cannot delete published services. Please unpublish first.' 
              }, 400);
            }
            
            // Remove service from array
            vendorServices.services.splice(serviceIndex, 1);
            await kv.set(vendorServicesKey, vendorServices);
            
            console.log(`✅ [VENDOR-SERVICES] Service ${serviceId} deleted successfully`);
            found = true;
            isCustomService = true;
            break;
          }
        }
      }
      
      if (!found) {
        return c.json({ error: 'Service not found' }, 404);
      }
      
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
  app.get("/make-server-3dd53475/admin/rate-change-requests", async (c) => {
    try {
      console.log(`📋 [ADMIN] Fetching pending rate change requests`);
      
      // Get all rate change requests
      const allRequests = await kv.getByPrefix('rate_change_request:');
      
      // Filter pending requests and sort by date
      const pendingRequests = allRequests
        .filter((req: any) => req.status === 'pending')
        .sort((a: any, b: any) => 
          new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
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
  app.post("/make-server-3dd53475/admin/rate-change-requests/:requestId/decide", async (c) => {
    try {
      const { requestId } = c.req.param();
      const { action, rejectionReason, adminNotes } = await c.req.json();
      
      console.log(`🔍 [ADMIN] Processing rate change request: ${requestId}, action: ${action}`);
      
      // Get request
      const requestKey = `rate_change_request:${requestId}`;
      const request = await kv.get(requestKey);
      
      if (!request) {
        return c.json({ error: 'Request not found' }, 404);
      }
      
      if (request.status !== 'pending') {
        return c.json({ error: 'Request already processed' }, 400);
      }
      
      if (action === 'approve') {
        // Approve and publish services
        const vendorServicesKey = `vendor_services:${request.vendorId}:${request.serviceStyle}`;
        const vendorServices = await kv.get(vendorServicesKey);
        
        if (vendorServices) {
          vendorServices.services.forEach((service: any) => {
            if (service.approvalRequestId === requestId) {
              service.publishStatus = 'published';
              service.publishedAt = new Date().toISOString();
              service.approvedBy = 'admin';
              delete service.approvalRequestId;
            }
          });
          
          vendorServices.lastPublished = new Date().toISOString();
          await kv.set(vendorServicesKey, vendorServices);
        }
        
        // Update request
        request.status = 'approved';
        request.approvedAt = new Date().toISOString();
        request.adminNotes = adminNotes;
        await kv.set(requestKey, request);
        
        console.log(`✅ [ADMIN] Request approved: ${requestId}`);
        
        // Send notification to vendor
        await sendVendorNotification({
          vendorId: request.vendorId,
          type: 'rate_change_approved',
          title: 'Services Approved',
          message: `Your ${request.services.length} service(s) have been approved and are now live for customers`,
          metadata: { requestId }
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
        
        // Update vendor services status
        const vendorServicesKey = `vendor_services:${request.vendorId}:${request.serviceStyle}`;
        const vendorServices = await kv.get(vendorServicesKey);
        
        if (vendorServices) {
          vendorServices.services.forEach((service: any) => {
            if (service.approvalRequestId === requestId) {
              service.publishStatus = 'rejected';
              service.rejectionReason = rejectionReason;
              delete service.approvalRequestId;
            }
          });
          
          await kv.set(vendorServicesKey, vendorServices);
        }
        
        // Update request
        request.status = 'rejected';
        request.rejectedAt = new Date().toISOString();
        request.rejectionReason = rejectionReason;
        request.adminNotes = adminNotes;
        await kv.set(requestKey, request);
        
        console.log(`❌ [ADMIN] Request rejected: ${requestId}`);
        
        // Send notification to vendor
        await sendVendorNotification({
          vendorId: request.vendorId,
          type: 'rate_change_rejected',
          title: 'Services Rejected',
          message: `Your service submission was rejected. Reason: ${rejectionReason}`,
          metadata: { requestId, rejectionReason }
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
  app.get("/make-server-3dd53475/vendor/:vendorId/notifications", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      console.log(`📬 [VENDOR-NOTIFICATIONS] Fetching notifications for vendor ${vendorId}`);
      
      // Get all notifications for this vendor
      const allNotifications = await kv.getByPrefix(`vendor_notification:${vendorId}:`);
      
      // Sort by date (newest first)
      const sortedNotifications = allNotifications.sort((a: any, b: any) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      
      return c.json({
        success: true,
        notifications: sortedNotifications,
        unreadCount: sortedNotifications.filter((n: any) => !n.isRead).length
      });
      
    } catch (error) {
      console.error('❌ [VENDOR-NOTIFICATIONS] Error fetching notifications:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  // ============================================
  // HELPER: SEND VENDOR NOTIFICATION
  // ============================================
  async function sendVendorNotification(data: {
    vendorId: string;
    type: string;
    title: string;
    message: string;
    metadata?: any;
  }) {
    try {
      const notificationId = `vendor_notification:${data.vendorId}:${Date.now()}`;
      const notification = {
        id: notificationId,
        vendorId: data.vendorId,
        type: data.type,
        title: data.title,
        message: data.message,
        metadata: data.metadata || {},
        isRead: false,
        createdAt: new Date().toISOString()
      };
      
      await kv.set(notificationId, notification);
      
      console.log(`📧 [NOTIFICATION] Sent to vendor ${data.vendorId}: ${data.title}`);
      
      // In production, integrate with push notification service here
      
      return notification;
    } catch (error) {
      console.error('❌ [NOTIFICATION] Error sending notification:', error);
    }
  }
}