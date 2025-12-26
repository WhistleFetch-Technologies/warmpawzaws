// Customer-facing service discovery endpoints
// ✅ MIGRATED TO SQL: All operations use SQL repositories, no KV store
import { Hono } from 'npm:hono';
import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import { getVendorsRepository } from "../../lib/repositories/vendors.ts";
import { getReviewsRepository } from "../../lib/repositories/reviews.ts";
import { sendSuccess, sendError } from "../_shared/response-utils.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export function registerCustomerServices(app: Hono) {
  /**
   * GET /make-server-3dd53475/customer/services
   * Get all published services for customers
   * ✅ SQL-ONLY: Uses vendor_services, services, and vendors tables
   */
  app.get("/make-server-3dd53475/customer/services", async (c) => {
  try {
    const category = c.req.query('category');
    const serviceStyle = c.req.query('serviceStyle');
    const location = c.req.query('location');
    const petType = c.req.query('petType');
    const roleId = c.req.query('roleId'); // Filter by vendor role
    
    console.log('🛍️ [CUSTOMER-SERVICES] Fetching published services (SQL)');
    console.log(`   Filters: category=${category}, style=${serviceStyle}, petType=${petType}, roleId=${roleId}`);
    
    // ✅ SQL: Get all active, approved vendors
    const vendorsRepo = getVendorsRepository();
    let allVendors = await vendorsRepo.findAllActive();
    
    // Filter by approval status
    allVendors = allVendors.filter((v: any) => 
      v.status === 'approved' || v.approval_status === 'approved'
    );
    
    // Filter by role if provided
    if (roleId) {
      allVendors = allVendors.filter((v: any) => v.role_id === roleId);
    }
    
    console.log(`   Found ${allVendors.length} approved vendors`);
    
    const allServices: any[] = [];
    
    // ✅ SQL: Get published vendor services for each vendor
    for (const vendor of allVendors) {
      const vendorId = vendor.id;
      const serviceStyles = serviceStyle ? [serviceStyle] : ['at_home', 'at_center', 'tele'];
      
      for (const style of serviceStyles) {
        // ✅ SQL: Query vendor_services table
        const { data: vendorServices, error: vsError } = await supabase
          .from('vendor_services')
          .select(`
            *,
            services:service_id (
              id,
              name,
              description,
              category,
              base_price,
              duration_minutes,
              metadata
            )
          `)
          .eq('vendor_id', vendorId)
          .eq('service_style', style)
          .eq('is_enabled', true)
          .eq('publish_status', 'published')
          .eq('is_published', true);
        
        if (vsError) {
          console.error(`❌ Error fetching vendor services for ${vendorId}:`, vsError);
          continue;
        }
        
        if (!vendorServices || vendorServices.length === 0) continue;
        
        // Get vendor reviews for rating calculation
        const reviewsRepo = getReviewsRepository();
        const reviews = await reviewsRepo.findByVendor(vendorId);
        const vendorRating = reviews.length > 0
          ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
          : 4.5;
        
        // ✅ FIX: Get staff services for this vendor (if style is at_center or at_home)
        let staffServicesMap = new Map();
        if (style === 'at_center' || style === 'at_home') {
          // First, get all active staff for this vendor
          const { data: vendorStaff } = await supabase
            .from('staff')
            .select('id')
            .eq('vendor_id', vendorId)
            .eq('is_active', true);
          
          if (vendorStaff && vendorStaff.length > 0) {
            const staffIds = vendorStaff.map((s: any) => s.id);
            
            // Get staff services for these staff members
            const { data: staffServices } = await supabase
              .from('staff_services')
              .select(`
                *,
                staff:staff_id (
                  id,
                  full_name,
                  rating,
                  service_radius,
                  is_available
                ),
                services:service_id (
                  id,
                  name,
                  description,
                  category,
                  base_price,
                  duration_minutes
                )
              `)
              .eq('is_enabled', true)
              .in('staff_id', staffIds);
            
            // Map service_id to staff services
            (staffServices || []).forEach((ss: any) => {
              if (ss.services && ss.staff && ss.staff.is_available) {
                const serviceId = ss.services.id;
                if (!staffServicesMap.has(serviceId)) {
                  staffServicesMap.set(serviceId, []);
                }
                staffServicesMap.get(serviceId).push({
                  staffId: ss.staff.id,
                  staffName: ss.staff.full_name,
                  staffRating: ss.staff.rating || 0,
                  serviceRadius: ss.staff.service_radius || 10,
                  customPrice: ss.custom_price,
                  customDuration: ss.custom_duration
                });
              }
            });
          }
        }
        
        // Enrich services with vendor information
        for (const vs of vendorServices) {
          const service = vs.services;
          if (!service) continue;
          
          // ✅ FIX: Check if this service has staff members available
          const availableStaff = staffServicesMap.get(service.id) || [];
          const hasAvailableStaff = availableStaff.length > 0;
          
          // For at_center services, only include if staff is available OR it's a general center service
          // For at_home services, only include if staff with service_radius is available
          if (style === 'at_center' && !hasAvailableStaff) {
            // Center services can be general (no specific staff), so include them
          } else if (style === 'at_home' && !hasAvailableStaff) {
            // Home services require available staff, skip if none
            continue;
          }
          
          const enrichedService = {
            // Service details
            id: vs.id,
            serviceId: service.id,
            serviceName: service.name,
            description: vs.custom_description || service.description,
            price: vs.custom_price || service.base_price,
            duration: vs.custom_duration || service.duration_minutes,
            categoryName: service.category,
            subCategoryName: service.metadata?.sub_category_name,
            serviceStyle: style,
            
            // ✅ NEW: Staff information
            availableStaff: availableStaff.map((s: any) => ({
              staffId: s.staffId,
              staffName: s.staffName,
              staffRating: s.staffRating,
              serviceRadius: s.serviceRadius,
              customPrice: s.customPrice,
              customDuration: s.customDuration
            })),
            hasAvailableStaff,
            
            // Package details (from metadata)
            isPackage: service.metadata?.is_package || false,
            packageDetails: service.metadata?.package_details,
            whatIncluded: service.metadata?.what_included || [],
            whatNotIncluded: service.metadata?.what_not_included || [],
            
            // Vendor details
            vendorId: vendor.vendor_id || vendor.id,
            vendorName: vendor.business_name || vendor.full_name,
            vendorRating,
            vendorReviewCount: reviews.length,
            vendorLocation: vendor.address || `${vendor.city}, ${vendor.state}`,
            vendorProfileImage: null, // TODO: Add to vendors table
            vendorType: vendor.vendor_type,
            vendorRoleId: vendor.role_id,
            vendorRoleName: null, // TODO: Join with vendor_roles table
            
            // Metadata
            publishedAt: vs.created_at,
            approvedBy: vs.approved_by
          };
          
          // Apply filters
          let includeService = true;
          
          // Category filter
          if (category && service.category !== category) {
            includeService = false;
          }
          
          // Pet type filter (from metadata)
          if (petType && service.metadata?.pet_types && !service.metadata.pet_types.includes(petType)) {
            includeService = false;
          }
          
          if (includeService) {
            allServices.push(enrichedService);
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
    
    return sendSuccess(c, {
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
    return sendError(c, error, 500);
  }
});

/**
 * GET /make-server-3dd53475/customer/services/:serviceId
 * Get detailed information about a specific service
 * ✅ SQL-ONLY: Uses vendor_services and services tables
 */
app.get("/make-server-3dd53475/customer/services/:serviceId", async (c) => {
  try {
    const { serviceId } = c.req.param();
    
    console.log(`🔍 [CUSTOMER-SERVICES] Fetching service details: ${serviceId} (SQL)`);
    
    // ✅ SQL: Find vendor service by ID or service_id
    const { data: vendorService, error: vsError } = await supabase
      .from('vendor_services')
      .select(`
        *,
        services:service_id (
          id,
          name,
          description,
          category,
          base_price,
          duration_minutes,
          metadata
        ),
        vendors:vendor_id (
          id,
          vendor_id,
          business_name,
          full_name,
          role_id,
          address,
          city,
          state,
          phone,
          email
        )
      `)
      .or(`id.eq.${serviceId},service_id.eq.${serviceId}`)
      .eq('is_enabled', true)
      .eq('publish_status', 'published')
      .eq('is_published', true)
      .single();
    
    if (vsError || !vendorService) {
      return sendError(c, 'Service not found or not published', 404);
    }
    
    const service = vendorService.services;
    const vendor = vendorService.vendors;
    
    if (!service || !vendor) {
      return sendError(c, 'Service or vendor data not found', 404);
    }
    
    // Get vendor reviews for rating
    const reviewsRepo = getReviewsRepository();
    const reviews = await reviewsRepo.findByVendor(vendor.id);
    const vendorRating = reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 4.5;
    
    return sendSuccess(c, {
      service: {
        id: vendorService.id,
        serviceId: service.id,
        serviceName: service.name,
        description: vendorService.custom_description || service.description,
        price: vendorService.custom_price || service.base_price,
        duration: vendorService.custom_duration || service.duration_minutes,
        categoryName: service.category,
        serviceStyle: vendorService.service_style,
        isPackage: service.metadata?.is_package || false,
        packageDetails: service.metadata?.package_details,
        vendorDetails: {
          id: vendor.vendor_id || vendor.id,
          businessName: vendor.business_name || vendor.full_name,
          rating: vendorRating,
          reviewCount: reviews.length,
          location: vendor.address || `${vendor.city}, ${vendor.state}`,
          contact: {
            phone: vendor.phone,
            email: vendor.email
          }
        }
      }
    });
    
  } catch (error) {
    console.error('❌ [CUSTOMER-SERVICES] Error fetching service details:', error);
    return sendError(c, error, 500);
  }
});

/**
 * GET /make-server-3dd53475/customer/packages
 * Get all published packages (filtered version of services)
 * ✅ SQL-ONLY: Uses vendor_services and services tables
 */
app.get("/make-server-3dd53475/customer/packages", async (c) => {
  try {
    console.log('📦 [CUSTOMER-SERVICES] Fetching published packages (SQL)');
    
    // ✅ SQL: Get all active, approved vendors
    const vendorsRepo = getVendorsRepository();
    const allVendors = (await vendorsRepo.findAllActive()).filter((v: any) => 
      v.status === 'approved' || v.approval_status === 'approved'
    );
    
    const allPackages: any[] = [];
    
    for (const vendor of allVendors) {
      const vendorId = vendor.id;
      const serviceStyles = ['at_home', 'at_center', 'tele'];
      
      for (const style of serviceStyles) {
        // ✅ SQL: Query vendor_services for packages only
        const { data: vendorServices, error: vsError } = await supabase
          .from('vendor_services')
          .select(`
            *,
            services:service_id (
              id,
              name,
              description,
              metadata
            )
          `)
          .eq('vendor_id', vendorId)
          .eq('service_style', style)
          .eq('is_enabled', true)
          .eq('publish_status', 'published')
          .eq('is_published', true);
        
        if (vsError || !vendorServices) continue;
        
        // Filter for packages (check metadata)
        const publishedPackages = vendorServices.filter((vs: any) => {
          const service = vs.services;
          return service && service.metadata?.is_package === true;
        });
        
        // Get vendor reviews
        const reviewsRepo = getReviewsRepository();
        const reviews = await reviewsRepo.findByVendor(vendorId);
        const vendorRating = reviews.length > 0
          ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
          : 4.5;
        
        for (const vs of publishedPackages) {
          const service = vs.services;
          allPackages.push({
            id: vs.id,
            serviceId: service.id,
            serviceName: service.name,
            description: vs.custom_description || service.description,
            price: vs.custom_price,
            duration: vs.custom_duration,
            serviceStyle: style,
            packageDetails: service.metadata?.package_details,
            vendorId: vendor.vendor_id || vendor.id,
            vendorName: vendor.business_name || vendor.full_name,
            vendorRating,
            vendorReviewCount: reviews.length,
            vendorLocation: vendor.address || `${vendor.city}, ${vendor.state}`
          });
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
    
    return sendSuccess(c, {
      packages: allPackages,
      total: allPackages.length
    });
    
  } catch (error) {
    console.error('❌ [CUSTOMER-SERVICES] Error fetching packages:', error);
    return sendError(c, error, 500);
  }
});

/**
 * GET /make-server-3dd53475/customer/vendors/:vendorId/services
 * Get all published services for a specific vendor
 * ✅ SQL-ONLY: Uses vendor_services and services tables
 */
app.get("/make-server-3dd53475/customer/vendors/:vendorId/services", async (c) => {
  try {
    const { vendorId } = c.req.param();
    
    console.log(`🏪 [CUSTOMER-SERVICES] Fetching services for vendor: ${vendorId} (SQL)`);
    
    // ✅ SQL: Get vendor by vendor_id or id
    const vendorsRepo = getVendorsRepository();
    let vendor = await vendorsRepo.findById(vendorId);
    
    if (!vendor) {
      // Try finding by vendor_id field
      const { data: vendorData } = await supabase
        .from('vendors')
        .select('*')
        .eq('vendor_id', vendorId)
        .eq('is_active', true)
        .single();
      
      if (!vendorData) {
        return sendError(c, 'Vendor not found or inactive', 404);
      }
      vendor = vendorData as any;
    }
    
    if (vendor.status !== 'approved' && vendor.approval_status !== 'approved') {
      return sendError(c, 'Vendor not approved', 403);
    }
    
    const allServices: any[] = [];
    const serviceStyles = ['at_home', 'at_center', 'tele'];
    
    for (const style of serviceStyles) {
      // ✅ SQL: Query vendor_services for this vendor
      const { data: vendorServices, error: vsError } = await supabase
        .from('vendor_services')
        .select(`
          *,
          services:service_id (
            id,
            name,
            description,
            category,
            base_price,
            duration_minutes,
            metadata
          )
        `)
        .eq('vendor_id', vendor.id)
        .eq('service_style', style)
        .eq('is_enabled', true)
        .eq('publish_status', 'published')
        .eq('is_published', true);
      
      if (vsError) {
        console.error(`❌ Error fetching vendor services:`, vsError);
        continue;
      }
      
      if (!vendorServices) continue;
      
      for (const vs of vendorServices) {
        const service = vs.services;
        if (!service) continue;
        
        allServices.push({
          id: vs.id,
          serviceId: service.id,
          serviceName: service.name,
          description: vs.custom_description || service.description,
          price: vs.custom_price || service.base_price,
          duration: vs.custom_duration || service.duration_minutes,
          categoryName: service.category,
          serviceStyle: style,
          isPackage: service.metadata?.is_package || false
        });
      }
    }
    
    // Get vendor reviews
    const reviewsRepo = getReviewsRepository();
    const reviews = await reviewsRepo.findByVendor(vendor.id);
    const vendorRating = reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 4.5;
    
    return sendSuccess(c, {
      vendor: {
        id: vendor.vendor_id || vendor.id,
        businessName: vendor.business_name || vendor.full_name,
        rating: vendorRating,
        reviewCount: reviews.length,
        location: vendor.address || `${vendor.city}, ${vendor.state}`,
        profileImage: null // TODO: Add to vendors table
      },
      services: allServices,
      total: allServices.length
    });
    
  } catch (error) {
    console.error('❌ [CUSTOMER-SERVICES] Error fetching vendor services:', error);
    return sendError(c, error, 500);
  }
});
}