// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
// Customer-facing service discovery endpoints
import { Hono } from 'hono';
import { sendSuccess, sendError } from "./response-utils";
import {
  getVendorsRepository,
  getVendorServicesRepository,
  getDbClient
} from '../../../supabase/lib/repositories/index';

export function registerCustomerServices(app: Hono) {
  /**
   * GET /make-server-3dd53475/customer/services
   * Get all published services for customers
   */
  app.get("/make-server-3dd53475/customer/services", async (c) => {
  try {
    const category = c.req.query('category');
    const serviceStyle = c.req.query('serviceStyle');
    const location = c.req.query('location');
    const petType = c.req.query('petType');
    const roleId = c.req.query('roleId'); // NEW: Filter by vendor role
    
    console.log('🛍️ [CUSTOMER-SERVICES] Fetching published services');
    console.log(`   Filters: category=${category}, style=${serviceStyle}, petType=${petType}, roleId=${roleId}`);
    
    // ✅ SQL: Get all approved vendors with published services
    const vendorsRepo = getVendorsRepository();
    const allVendors = await vendorsRepo.findAll();
    
    // Accept vendors who are approved and active
    const activeVendors = allVendors.filter((v: any) => {
      const isApproved = v.application_status === 'approved' || v.status === 'approved';
      return isApproved && v.is_active !== false;
    });
    
    console.log(`   Found ${activeVendors.length} approved vendors out of ${allVendors.length} total`);
    
    const allServices: any[] = [];
    const servicesRepo = getVendorServicesRepository();
    
    // Iterate through each vendor to get their published services
    for (const vendor of activeVendors) {
      const vendorId = vendor.id;
      
      // ✅ SQL: Get all published services for this vendor
      const vendorServices = await servicesRepo.findByVendor(vendorId, {
        publish_status: 'published',
        is_enabled: true
      });
      
      // Filter by service style if specified
      const filteredServices = serviceStyle 
        ? vendorServices.filter(s => (s.service_style || s.serviceStyle) === serviceStyle)
        : vendorServices;
      
      // Enrich services with vendor information
      for (const service of filteredServices) {
          
        const enrichedService = {
          // Service details
          id: service.id,
          serviceName: service.service_name || service.name,
          description: service.description || service.custom_description,
          price: service.custom_price || service.price || 0,
          duration: service.custom_duration || service.duration || 30,
          categoryName: service.category_name || service.categoryName,
          subCategoryName: service.sub_category_name || service.subCategoryName,
          serviceStyle: service.service_style || service.serviceStyle,
          
          // Package details
          isPackage: service.is_package || service.isPackage || false,
          packageDetails: service.package_details || service.packageDetails,
          whatIncluded: service.what_included || service.whatIncluded || [],
          whatNotIncluded: service.what_not_included || service.whatNotIncluded || [],
          
          // Vendor details
          vendorId,
          vendorName: vendor.business_name || vendor.full_name || vendor.businessName || vendor.fullName,
          vendorRating: vendor.rating || 4.5,
          vendorReviewCount: vendor.review_count || vendor.reviewCount || 0,
          vendorLocation: vendor.location || vendor.address,
          vendorProfileImage: vendor.profile_image || vendor.profileImage,
          vendorType: vendor.vendor_type || vendor.vendorType,
          vendorRoleId: vendor.role_id || vendor.roleId,
          vendorRoleName: vendor.role_name || vendor.roleName,
          
          // Metadata
          publishedAt: service.published_at || service.publishedAt,
          approvedBy: service.approved_by || service.approvedBy
        };
        
        // Apply filters
        let includeService = true;
        
        // Category filter
        if (category && enrichedService.categoryName !== category) {
          includeService = false;
        }
        
        // Pet type filter
        const petTypes = service.pet_types || service.petTypes || [];
        if (petType && petTypes.length > 0 && !petTypes.includes(petType)) {
          includeService = false;
        }
        
        // Role ID filter
        if (roleId && enrichedService.vendorRoleId !== roleId) {
          includeService = false;
        }
        
        if (includeService) {
          allServices.push(enrichedService);
        }
      }
    }
    
    // Sort by rating and published date
    allServices.sort((a, b) => {
      // First by vendor rating
      if (b.vendorRating !== a.vendorRating) {
        return b.vendorRating - a.vendorRating;
      }
      // Then by published date (newer first)
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    });
    
    console.log(`✅ [CUSTOMER-SERVICES] Returning ${allServices.length} published services`);
    
    return c.json({
      success: true,
      services: allServices,
      total: allServices.length,
      filters: {
        category,
        serviceStyle,
        petType
      }
    });
    
  } catch (error) {
    console.error('❌ [CUSTOMER-SERVICES] Error fetching services:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * GET /make-server-3dd53475/customer/services/:serviceId
 * Get detailed information about a specific service
 */
app.get("/make-server-3dd53475/customer/services/:serviceId", async (c) => {
  try {
    const { serviceId } = c.req.param();
    
    console.log(`🔍 [CUSTOMER-SERVICES] Fetching service details: ${serviceId}`);
    
    // ✅ SQL: Get published service from vendor_services table
    const servicesRepo = getVendorServicesRepository();
    const service = await servicesRepo.findById(serviceId);
    
    if (service && service.publish_status === 'published' && service.is_enabled) {
      // ✅ SQL: Get vendor details
      const vendorsRepo = getVendorsRepository();
      const vendor = await vendorsRepo.findById(service.vendor_id);
      
      return c.json({
        success: true,
        service: {
          ...service,
          vendorDetails: vendor ? {
            id: vendor.id,
            businessName: vendor.business_name || vendor.businessName,
            rating: vendor.rating || 4.5,
            reviewCount: vendor.review_count || vendor.reviewCount || 0,
            location: vendor.location || vendor.address,
            contact: vendor.contact || vendor.contact_number,
            businessHours: vendor.operating_hours || vendor.businessHours
          } : null
        }
      });
    }
    
    return c.json({ error: 'Service not found or not published' }, 404);
    
  } catch (error) {
    console.error('❌ [CUSTOMER-SERVICES] Error fetching service details:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * GET /make-server-3dd53475/customer/packages
 * Get all published packages (filtered version of services)
 */
app.get("/make-server-3dd53475/customer/packages", async (c) => {
  try {
    console.log('📦 [CUSTOMER-SERVICES] Fetching published packages');
    
    // ✅ SQL: Get all approved vendors with published packages
    const vendorsRepo = getVendorsRepository();
    const allVendors = await vendorsRepo.findAll();
    const activeVendors = allVendors.filter((v: any) => 
      (v.status === 'active' || v.application_status === 'approved') && v.is_active !== false
    );
    
    const allPackages: any[] = [];
    const servicesRepo = getVendorServicesRepository();
    
    for (const vendor of activeVendors) {
      const vendorId = vendor.id;
      
      // ✅ SQL: Get published packages for this vendor
      const vendorPackages = await servicesRepo.findByVendor(vendorId, {
        publish_status: 'published',
        is_enabled: true,
        is_package: true
      });
      
      for (const pkg of vendorPackages) {
        allPackages.push({
          ...pkg,
          serviceStyle: pkg.service_style || pkg.serviceStyle,
          vendorId,
          vendorName: vendor.business_name || vendor.full_name || vendor.businessName || vendor.fullName,
          vendorRating: vendor.rating || 4.5,
          vendorReviewCount: vendor.review_count || vendor.reviewCount || 0,
          vendorLocation: vendor.location || vendor.address
        });
      }
    }
    
    // Sort by savings (best deals first)
    allPackages.sort((a, b) => {
      const packageDetailsA = a.package_details || a.packageDetails || {};
      const packageDetailsB = b.package_details || b.packageDetails || {};
      const savingsA = packageDetailsA.pricing?.savings || 0;
      const savingsB = packageDetailsB.pricing?.savings || 0;
      return savingsB - savingsA;
    });
    
    console.log(`✅ [CUSTOMER-SERVICES] Returning ${allPackages.length} packages`);
    
    return c.json({
      success: true,
      packages: allPackages,
      total: allPackages.length
    });
    
  } catch (error) {
    console.error('❌ [CUSTOMER-SERVICES] Error fetching packages:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * GET /make-server-3dd53475/customer/vendors/:vendorId/services
 * Get all published services for a specific vendor
 */
app.get("/make-server-3dd53475/customer/vendors/:vendorId/services", async (c) => {
  try {
    const { vendorId } = c.req.param();
    
    console.log(`🏪 [CUSTOMER-SERVICES] Fetching services for vendor: ${vendorId}`);
    
    // ✅ SQL: Get vendor and their published services
    const vendorsRepo = getVendorsRepository();
    const vendor = await vendorsRepo.findById(vendorId);
    if (!vendor || (vendor.status !== 'active' && vendor.application_status !== 'approved') || vendor.is_active === false) {
      return c.json({ error: 'Vendor not found or inactive' }, 404);
    }
    
    // ✅ SQL: Get all published services for this vendor
    const servicesRepo = getVendorServicesRepository();
    const allServices = await servicesRepo.findByVendor(vendorId, {
      publish_status: 'published',
      is_enabled: true
    });
    
    const enrichedServices = allServices.map((s: any) => ({
      ...s,
      serviceStyle: s.service_style || s.serviceStyle
    }));
    
    return c.json({
      success: true,
      vendor: {
        id: vendorId,
        businessName: vendor.business_name || vendor.full_name || vendor.businessName || vendor.fullName,
        rating: vendor.rating || 4.5,
        reviewCount: vendor.review_count || vendor.reviewCount || 0,
        location: vendor.location || vendor.address,
        profileImage: vendor.profile_image || vendor.profileImage
      },
      services: enrichedServices,
      total: enrichedServices.length
    });
    
  } catch (error) {
    console.error('❌ [CUSTOMER-SERVICES] Error fetching vendor services:', error);
    return c.json({ error: String(error) }, 500);
  }
});
}