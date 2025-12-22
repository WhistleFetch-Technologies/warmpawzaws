// Customer-facing service discovery endpoints
import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { sendSuccess, sendError } from "./response-utils.ts";

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
    
    // Get all vendors with published services
    const allVendors = await kv.getByPrefix('vendor:vendor_');
    
    // Accept vendors who are:
    // 1. Approved (applicationStatus === 'approved') - from onboarding
    // 2. Active (status === 'active') - fully setup with services
    const activeVendors = allVendors.filter((v: any) => {
      const isApproved = v.applicationStatus === 'approved' || v.status === 'approved';
      return isApproved;
    });
    
    console.log(`   Found ${activeVendors.length} approved vendors out of ${allVendors.length} total`);
    
    const allServices: any[] = [];
    
    // Iterate through each vendor to get their published services
    for (const vendor of activeVendors) {
      const vendorId = vendor.id || vendor.vendorId;
      const serviceStyles = ['at_home', 'at_center', 'tele'];
      
      for (const style of serviceStyles) {
        // Skip if filtering by service style and this doesn't match
        if (serviceStyle && style !== serviceStyle) continue;
        
        const vendorServicesKey = `vendor_services:${vendorId}:${style}`;
        const vendorServices = await kv.get(vendorServicesKey);
        
        if (vendorServices && vendorServices.services) {
          // Filter only published services
          const publishedServices = vendorServices.services.filter(
            (s: any) => s.publishStatus === 'published' && s.isEnabled
          );
          
          // Enrich services with vendor information
          for (const service of publishedServices) {
            const enrichedService = {
              // Service details
              id: service.id || service.serviceId,
              serviceName: service.serviceName || service.name,
              description: service.description || service.customDescription,
              price: service.customPrice || service.price,
              duration: service.customDuration || service.duration,
              categoryName: service.categoryName,
              subCategoryName: service.subCategoryName,
              serviceStyle: style,
              
              // Package details
              isPackage: service.isPackage || false,
              packageDetails: service.packageDetails,
              whatIncluded: service.whatIncluded || [],
              whatNotIncluded: service.whatNotIncluded || [],
              
              // Vendor details
              vendorId,
              vendorName: vendor.businessName || vendor.fullName,
              vendorRating: vendor.rating || 4.5,
              vendorReviewCount: vendor.reviewCount || 0,
              vendorLocation: vendor.location || vendor.address,
              vendorProfileImage: vendor.profileImage,
              vendorType: vendor.vendorType,
              vendorRoleId: vendor.roleId, // NEW: Include vendor role ID for filtering
              vendorRoleName: vendor.roleName, // NEW: Include vendor role name
              
              // Metadata
              publishedAt: service.publishedAt,
              approvedBy: service.approvedBy
            };
            
            // Apply filters
            let includeService = true;
            
            // Category filter
            if (category && service.categoryName !== category) {
              includeService = false;
            }
            
            // Pet type filter
            if (petType && service.petTypes && !service.petTypes.includes(petType)) {
              includeService = false;
            }
            
            // Role ID filter
            if (roleId && vendor.roleId !== roleId) {
              includeService = false;
            }
            
            if (includeService) {
              allServices.push(enrichedService);
            }
          }
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
    
    // Check if it's a published service
    const publishedServices = await kv.getByPrefix('published_service:');
    const service = publishedServices.find((s: any) => s.id === serviceId || s.serviceId === serviceId);
    
    if (service) {
      // Get vendor details
      const vendor = await kv.get(`vendor:${service.vendorId}`);
      
      return c.json({
        success: true,
        service: {
          ...service,
          vendorDetails: vendor ? {
            id: vendor.id || vendor.vendorId,
            businessName: vendor.businessName,
            rating: vendor.rating || 4.5,
            reviewCount: vendor.reviewCount || 0,
            location: vendor.location || vendor.address,
            contact: vendor.contact,
            businessHours: vendor.businessHours
          } : null
        }
      });
    }
    
    // Fallback: Search in vendor_services
    const allVendors = await kv.getByPrefix('vendor:');
    
    for (const vendor of allVendors) {
      const vendorId = vendor.id || vendor.vendorId;
      const serviceStyles = ['at_home', 'at_center', 'tele'];
      
      for (const style of serviceStyles) {
        const vendorServicesKey = `vendor_services:${vendorId}:${style}`;
        const vendorServices = await kv.get(vendorServicesKey);
        
        if (vendorServices && vendorServices.services) {
          const foundService = vendorServices.services.find(
            (s: any) => (s.id === serviceId || s.serviceId === serviceId) && s.publishStatus === 'published'
          );
          
          if (foundService) {
            return c.json({
              success: true,
              service: {
                ...foundService,
                vendorDetails: {
                  id: vendorId,
                  businessName: vendor.businessName || vendor.fullName,
                  rating: vendor.rating || 4.5,
                  reviewCount: vendor.reviewCount || 0,
                  location: vendor.location || vendor.address,
                  contact: vendor.contact,
                  businessHours: vendor.businessHours
                }
              }
            });
          }
        }
      }
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
    
    const allVendors = await kv.getByPrefix('vendor:');
    const activeVendors = allVendors.filter((v: any) => 
      v.status === 'active' && v.approvalStatus === 'approved'
    );
    
    const allPackages: any[] = [];
    
    for (const vendor of activeVendors) {
      const vendorId = vendor.id || vendor.vendorId;
      const serviceStyles = ['at_home', 'at_center', 'tele'];
      
      for (const style of serviceStyles) {
        const vendorServicesKey = `vendor_services:${vendorId}:${style}`;
        const vendorServices = await kv.get(vendorServicesKey);
        
        if (vendorServices && vendorServices.services) {
          const publishedPackages = vendorServices.services.filter(
            (s: any) => s.publishStatus === 'published' && s.isEnabled && s.isPackage === true
          );
          
          for (const pkg of publishedPackages) {
            allPackages.push({
              ...pkg,
              serviceStyle: style,
              vendorId,
              vendorName: vendor.businessName || vendor.fullName,
              vendorRating: vendor.rating || 4.5,
              vendorReviewCount: vendor.reviewCount || 0,
              vendorLocation: vendor.location || vendor.address
            });
          }
        }
      }
    }
    
    // Sort by savings (best deals first)
    allPackages.sort((a, b) => {
      const savingsA = a.packageDetails?.pricing?.savings || 0;
      const savingsB = b.packageDetails?.pricing?.savings || 0;
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
    
    const vendor = await kv.get(`vendor:${vendorId}`);
    if (!vendor || vendor.status !== 'active') {
      return c.json({ error: 'Vendor not found or inactive' }, 404);
    }
    
    const allServices: any[] = [];
    const serviceStyles = ['at_home', 'at_center', 'tele'];
    
    for (const style of serviceStyles) {
      const vendorServicesKey = `vendor_services:${vendorId}:${style}`;
      const vendorServices = await kv.get(vendorServicesKey);
      
      if (vendorServices && vendorServices.services) {
        const publishedServices = vendorServices.services.filter(
          (s: any) => s.publishStatus === 'published' && s.isEnabled
        );
        
        allServices.push(...publishedServices.map((s: any) => ({
          ...s,
          serviceStyle: style
        })));
      }
    }
    
    return c.json({
      success: true,
      vendor: {
        id: vendorId,
        businessName: vendor.businessName || vendor.fullName,
        rating: vendor.rating || 4.5,
        reviewCount: vendor.reviewCount || 0,
        location: vendor.location || vendor.address,
        profileImage: vendor.profileImage
      },
      services: allServices,
      total: allServices.length
    });
    
  } catch (error) {
    console.error('❌ [CUSTOMER-SERVICES] Error fetching vendor services:', error);
    return c.json({ error: String(error) }, 500);
  }
});
}