import { Hono } from "npm:hono";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import { getVendorsRepository } from "../../lib/repositories/vendors.ts";
import { getReviewsRepository } from "../../lib/repositories/reviews.ts";
import { getStaffRepository } from "../../lib/repositories/staff.ts";
import { getSchedulingRepository } from "../../lib/repositories/scheduling.ts";
import { getServicesRepository } from "../../lib/repositories/services.ts";

/**
 * UNIVERSAL SERVICE DISCOVERY
 * Production-ready customer-facing service search
 * ✅ MIGRATED TO SQL: All operations use SQL repositories, no KV store
 * 
 * Features:
 * - Multi-category search (Vet, Grooming, Training, Walker, Boarding, etc.)
 * - Location-based filtering
 * - Rating filter
 * - Availability check
 * - Vendor profiles
 * - Unified booking flow
 * - SQL-based service queries with live status
 */

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export function registerUniversalServiceDiscovery(app: Hono) {
  const BASE = '/make-server-3dd53475';

  // =============================================
  // DISCOVER SERVICES (Main Customer Entry Point)
  // =============================================
  app.get(`${BASE}/customer/discover-services`, async (c) => {
    try {
      const category = c.req.query('category'); // 'vet', 'grooming', 'training', 'walker', 'boarding', 'nutrition', 'adoption', 'marketplace'
      const location = c.req.query('location');
      const minRating = c.req.query('minRating');
      const availability = c.req.query('availability'); // 'today', 'this_week', 'anytime'
      const petType = c.req.query('petType'); // 'dog', 'cat'
      const sortBy = c.req.query('sortBy'); // 'rating', 'distance', 'price'

      console.log(`[DISCOVERY] Search - category: ${category}, location: ${location}`);

      // ✅ SQL: Get all active vendors (filtered by role if category provided)
      const vendorsRepo = getVendorsRepository();
      let allVendors;
      
      if (category) {
        // Map category to role_id
        const categoryRoleMap: any = {
          'vet': ['vet_clinic', 'veterinarian'],
          'grooming': ['grooming_salon', 'pet_groomer', 'groomer'],
          'training': ['trainer', 'pet_trainer'],
          'walker': ['dog_walker', 'pet_walker'],
          'boarding': ['boarding_resort', 'pet_boarding'],
          'nutrition': ['nutritionist'],
          'adoption': ['ngo', 'shelter', 'breeder'],
          'marketplace': ['pet_store']
        };
        
        const targetRoles = categoryRoleMap[category] || [];
        // Get vendors for each role
        const vendorPromises = targetRoles.map(roleId => 
          vendorsRepo.findByRole(roleId, { status: 'approved' })
        );
        const vendorArrays = await Promise.all(vendorPromises);
        allVendors = vendorArrays.flat();
      } else {
        allVendors = await vendorsRepo.findAllActive();
      }
      
      // Transform SQL vendors to match expected format
      const activeVendors = allVendors.map((v: any) => ({
        id: v.vendor_id || v.id,
        vendorId: v.vendor_id || v.id,
        businessName: v.business_name,
        roleId: v.role_id,
        isActive: v.is_active,
        status: v.status,
        address: v.address,
        city: v.city,
        state: v.state,
        phone: v.phone,
        email: v.email,
        latitude: v.latitude,
        longitude: v.longitude,
        location: v.latitude && v.longitude ? {
          coordinates: { lat: v.latitude, lng: v.longitude },
          address: v.address
        } : null,
        rating: 0, // Will be calculated from reviews
        operatingHours: v.operating_hours ? JSON.parse(v.operating_hours) : null,
        logo: null, // Will need to add to vendors table if needed
        image: null,
        description: null
      }));

      let vendors: any[] = [];

      // Filter by category (role)
      if (category) {
        const categoryRoleMap: any = {
          'vet': 'vet_clinic',
          'grooming': 'grooming_salon',
          'training': 'trainer',
          'walker': 'dog_walker',
          'boarding': 'boarding_resort',
          'nutrition': 'nutritionist',
          'adoption': ['ngo', 'shelter', 'breeder'],
          'marketplace': 'pet_store'
        };

        const targetRoles = Array.isArray(categoryRoleMap[category])
          ? categoryRoleMap[category]
          : [categoryRoleMap[category]];

        vendors = activeVendors.filter((v: any) => 
          targetRoles.includes(v.roleId)
        );
      } else {
        vendors = activeVendors;
      }

      // Filter by location (simple text match for now)
      if (location) {
        vendors = vendors.filter((v: any) => 
          v.address?.toLowerCase().includes(location.toLowerCase()) ||
          v.city?.toLowerCase().includes(location.toLowerCase())
        );
      }

      // Filter by rating
      if (minRating) {
        vendors = vendors.filter((v: any) => 
          (v.rating || 0) >= parseFloat(minRating)
        );
      }

      // Enrich vendor data
      const enrichedVendors = await Promise.all(vendors.map(async (vendor: any) => {
        // Get services/offerings - ✅ UPDATED: Use SQL database
        let offerings: any[] = [];
        
        try {
          // Get vendor UUID from vendor_id
          const { data: vendorRecord } = await supabase
            .from('vendors')
            .select('id')
            .eq('vendor_id', vendor.id)
            .single();

          if (vendorRecord) {
            // ✅ SQL QUERY: Get all live, published services for this vendor
            const { data: sqlServices, error: servicesError } = await supabase
              .from('services')
              .select(`
                *,
                vendor_services!inner (*),
                staff_services (*)
              `)
              .eq('vendor_id', vendorRecord.id)
              .eq('is_live', true)
              .eq('publish_status', 'published')
              .eq('is_active', true);

            if (!servicesError && sqlServices) {
              // Transform SQL services to match expected format with COMPLETE information
              offerings = sqlServices.map((service: any) => {
                const vendorService = service.vendor_services?.[0] || {};
                return {
                  id: service.service_id || service.id,
                  serviceId: service.service_id || service.id,
                  serviceName: service.name || vendorService.service_name,
                  name: service.name || vendorService.service_name,
                  description: service.description || vendorService.custom_description || vendorService.description || '',
                  price: vendorService.custom_price || vendorService.price || service.base_price || 0,
                  duration: vendorService.custom_duration || vendorService.duration_minutes || service.duration_minutes || 30,
                  category: service.category || vendorService.category || '',
                  subCategory: service.sub_category || vendorService.sub_category || '',
                  serviceStyle: vendorService.service_style || service.service_style || 'at_center',
                  isActive: vendorService.is_enabled !== false && service.is_active !== false,
                  isLive: service.is_live !== false,
                  publishStatus: vendorService.publish_status || service.publish_status || 'published',
                  staffId: service.staff_services?.[0]?.staff_id || null,
                  // ✅ NEW: Include metadata for complete information
                  metadata: vendorService.metadata || service.metadata || {},
                  images: service.images || vendorService.images || [],
                  tags: service.tags || vendorService.tags || []
                };
              });

              console.log(`[DISCOVERY-SQL] Vendor ${vendor.id}: Found ${offerings.length} live services from SQL`);
            }

            // ✅ ALSO: Get staff services (center services enabled by staff)
            const { data: staffRecords } = await supabase
              .from('staff')
              .select('id')
              .eq('vendor_id', vendorRecord.id)
              .eq('is_active', true);

            if (staffRecords && staffRecords.length > 0) {
              const staffIds = staffRecords.map((s: any) => s.id);
              
              const { data: staffServices, error: staffServicesError } = await supabase
                .from('staff_services')
                .select(`
                  *,
                  services!inner (*),
                  vendor_services (*)
                `)
                .in('staff_id', staffIds)
                .eq('is_enabled', true);

              if (!staffServicesError && staffServices) {
                const staffServiceOfferings = staffServices
                  .filter((ss: any) => ss.services?.is_live && ss.services?.publish_status === 'published')
                  .map((ss: any) => ({
                    id: ss.services?.service_id || ss.services?.id,
                    serviceId: ss.services?.service_id || ss.services?.id,
                    serviceName: ss.services?.name,
                    name: ss.services?.name,
                    description: ss.services?.description,
                    price: ss.custom_price || ss.vendor_services?.custom_price || ss.services?.base_price,
                    duration: ss.custom_duration || ss.vendor_services?.custom_duration || ss.services?.duration_minutes,
                    category: ss.services?.category,
                    serviceStyle: ss.services?.service_style,
                    isActive: true,
                    isLive: true,
                    publishStatus: 'published',
                    staffId: ss.staff_id,
                    isStaffService: true
                  }));

                offerings = [...offerings, ...staffServiceOfferings];
                console.log(`[DISCOVERY-SQL] Added ${staffServiceOfferings.length} staff-enabled services`);
              }
            }
          }
        } catch (error) {
          console.error(`[DISCOVERY-SQL] Error fetching services for vendor ${vendor.id}:`, error);
          // No fallback - SQL only
          offerings = [];
        }
        
        // ✅ SQL: Get non-service offerings (packages, rooms, etc.) from SQL tables
        if (offerings.length === 0) {
          try {
            const vendorRecord = await supabase
              .from('vendors')
              .select('id')
              .eq('vendor_id', vendor.id)
              .single();
            
            if (vendorRecord?.data) {
              if (['grooming_salon', 'trainer', 'dog_walker'].includes(vendor.roleId)) {
                // Get service packages from SQL
                const { data: packages } = await supabase
                  .from('service_packages')
                  .select('*')
                  .eq('vendor_id', vendorRecord.data.id)
                  .eq('is_active', true);
                offerings = (packages || []).map((p: any) => ({
                  id: p.id,
                  serviceName: p.name,
                  name: p.name,
                  price: p.price,
                  dayPrice: p.price,
                  isActive: p.is_active
                }));
              } else if (vendor.roleId === 'boarding_resort') {
                // Get boarding rooms from SQL (if table exists)
                // For now, return empty array - will need to create table if needed
                offerings = [];
              } else if (vendor.roleId === 'nutritionist') {
                // Get meal products from SQL (if table exists)
                offerings = [];
              } else if (['ngo', 'shelter', 'breeder'].includes(vendor.roleId)) {
                // Get pet listings from SQL (if table exists)
                offerings = [];
              } else if (vendor.roleId === 'pet_store') {
                // Get marketplace products from SQL
                const { data: products } = await supabase
                  .from('products')
                  .select('*')
                  .eq('vendor_id', vendorRecord.data.id)
                  .eq('is_active', true);
                offerings = (products || []).map((p: any) => ({
                  id: p.id,
                  serviceName: p.name,
                  name: p.name,
                  price: p.price,
                  isActive: p.is_active
                }));
              }
            }
          } catch (error) {
            console.error(`[DISCOVERY] Error fetching non-service offerings for vendor ${vendor.id}:`, error);
          }
        }

        // ✅ SQL: Calculate availability score
        let availabilityScore = 0;
        try {
          const schedulingRepo = getSchedulingRepository();
          // Get vendor availability for today
          const today = new Date();
          const dayOfWeek = today.getDay();
          const vendorRecord = await supabase
            .from('vendors')
            .select('id')
            .eq('vendor_id', vendor.id)
            .single();
          
          if (vendorRecord?.data) {
            const { data: availability } = await supabase
              .from('vendor_schedule_slots')
              .select('*')
              .eq('vendor_id', vendorRecord.data.id)
              .eq('day_of_week', dayOfWeek)
              .eq('is_enabled', true)
              .limit(1);
            
            if (availability && availability.length > 0) {
              availabilityScore = 100;
            }
          }
        } catch (error) {
          console.error(`[DISCOVERY] Error checking availability for vendor ${vendor.id}:`, error);
        }

        // ✅ SQL: Get reviews
        const reviewsRepo = getReviewsRepository();
        let reviews: any[] = [];
        let avgRating = 0;
        try {
          const vendorRecord = await supabase
            .from('vendors')
            .select('id')
            .eq('vendor_id', vendor.id)
            .single();
          
          if (vendorRecord?.data) {
            reviews = await reviewsRepo.findByVendor(vendorRecord.data.id);
            avgRating = reviews.length > 0
              ? reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length
              : 0;
          }
        } catch (error) {
          console.error(`[DISCOVERY] Error fetching reviews for vendor ${vendor.id}:`, error);
        }

        return {
          id: vendor.id,
          businessName: vendor.businessName,
          roleId: vendor.roleId,
          category: getCategoryFromRole(vendor.roleId),
          
          // Location
          address: vendor.address,
          city: vendor.city,
          location: vendor.location,
          
          // Ratings & Reviews
          rating: avgRating || vendor.rating || 0,
          totalReviews: reviews.length,
          
          // Offerings
          totalOfferings: offerings.filter((o: any) => o.isActive !== false).length,
          featuredOfferings: offerings
            .filter((o: any) => o.isActive !== false)
            .slice(0, 3)
            .map((o: any) => ({
              id: o.id,
              name: o.serviceName || o.name,
              price: o.price || o.dayPrice || 0,
              // ✅ NEW: Include service style information
              serviceStyle: o.serviceStyle || o.type || null,
              staffId: o.staffId || null, // Indicates if this is a staff service
              category: o.category || o.categoryName || null
            })),
          
          // Availability
          availabilityScore,
          isAvailableToday: availabilityScore === 100,
          
          // Additional info
          description: vendor.description || '',
          phone: vendor.phone,
          email: vendor.email,
          image: vendor.logo || vendor.image,
          
          // Operating hours
          operatingHours: vendor.operatingHours || null,
          
          // Distance (placeholder - would calculate with customer location)
          distance: null
        };
      }));

      // Sort results
      let sorted = enrichedVendors;
      
      if (sortBy === 'rating') {
        sorted = enrichedVendors.sort((a, b) => b.rating - a.rating);
      } else if (sortBy === 'price') {
        sorted = enrichedVendors.sort((a, b) => {
          const aPrice = a.featuredOfferings[0]?.price || 0;
          const bPrice = b.featuredOfferings[0]?.price || 0;
          return aPrice - bPrice;
        });
      }

      return c.json({
        success: true,
        vendors: sorted,
        total: sorted.length,
        filters: {
          categories: getAvailableCategories(),
          locations: [...new Set(vendors.map((v: any) => v.city).filter(Boolean))],
          priceRange: calculatePriceRange(enrichedVendors)
        }
      });

    } catch (error) {
      console.error('[DISCOVERY] Error:', error);
      return c.json({ error: 'Failed to discover services' }, 500);
    }
  });

  // =============================================
  // GET VENDOR PROFILE (Detailed View)
  // =============================================
  app.get(`${BASE}/customer/vendor/:vendorId/profile`, async (c) => {
    try {
      const { vendorId } = c.req.param();

      console.log(`[DISCOVERY] Fetching vendor profile: ${vendorId}`);

      // ✅ SQL: Get vendor
      const vendorsRepo = getVendorsRepository();
      const vendorRecord = await supabase
        .from('vendors')
        .select('*')
        .eq('vendor_id', vendorId)
        .single();
      
      if (!vendorRecord?.data) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      const vendor = vendorRecord.data;
      const vendorUuid = vendor.id;

      // ✅ SQL: Get all vendor data
      const [
        servicesData,
        packagesData,
        productsData,
        staffData,
        reviewsData
      ] = await Promise.all([
        // Services
        supabase
          .from('services')
          .select('*, vendor_services!inner(*)')
          .eq('vendor_id', vendorUuid)
          .eq('is_active', true),
        // Service packages
        supabase
          .from('service_packages')
          .select('*')
          .eq('vendor_id', vendorUuid)
          .eq('is_active', true),
        // Products
        supabase
          .from('products')
          .select('*')
          .eq('vendor_id', vendorUuid)
          .eq('is_active', true),
        // Staff
        supabase
          .from('staff')
          .select('*')
          .eq('vendor_id', vendorUuid)
          .eq('is_active', true),
        // Reviews
        getReviewsRepository().findByVendor(vendorUuid)
      ]);

      const services = (servicesData?.data || []).map((s: any) => ({
        id: s.id,
        serviceId: s.id,
        serviceName: s.name,
        name: s.name,
        description: s.description,
        price: s.vendor_services?.[0]?.custom_price || s.base_price,
        category: s.category,
        isActive: s.is_active
      }));

      const packages = (packagesData?.data || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        isActive: p.is_active
      }));

      const products = (productsData?.data || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        isActive: p.is_active
      }));

      const staff = (staffData?.data || []).map((s: any) => ({
        id: s.id,
        staffId: s.staff_id || s.id,
        name: s.full_name,
        role: s.role,
        specialization: s.specialization,
        photo: s.photo_url
      }));

      const reviews = reviewsData || [];
      const schedules: any[] = []; // Will need to query from vendor_schedule_slots if needed

      // Calculate ratings breakdown
      const ratingBreakdown = {
        5: reviews.filter((r: any) => r.rating === 5).length,
        4: reviews.filter((r: any) => r.rating === 4).length,
        3: reviews.filter((r: any) => r.rating === 3).length,
        2: reviews.filter((r: any) => r.rating === 2).length,
        1: reviews.filter((r: any) => r.rating === 1).length
      };

      const avgRating = reviews.length > 0
        ? reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length
        : 0;

      // ✅ SQL: Get offerings based on vendor type
      let offerings: any[] = [];
      
      if (vendor.role_id === 'vet_clinic' || vendor.role_id === 'veterinarian') {
        // Include both vendor services AND staff services in profile
        const vendorServices = services.filter((s: any) => s.isActive);
        
        // Get staff-level services from SQL
        const staffIds = staff.map((s: any) => s.id);
        let staffServices: any[] = [];
        
        if (staffIds.length > 0) {
          const { data: staffServicesData } = await supabase
            .from('staff_services')
            .select('*, services!inner(*)')
            .in('staff_id', staffIds)
            .eq('is_enabled', true);
          
          staffServices = (staffServicesData || []).map((ss: any) => ({
            id: ss.services?.id,
            serviceId: ss.services?.id,
            serviceName: ss.services?.name,
            name: ss.services?.name,
            description: ss.services?.description,
            price: ss.custom_price || ss.services?.base_price,
            category: ss.services?.category,
            isActive: true
          }));
        }
        
        // Merge both
        offerings = [...vendorServices, ...staffServices];
        
        console.log(`[DISCOVERY] Profile ${vendorId}: ${vendorServices.length} vendor + ${staffServices.length} staff = ${offerings.length} total services`);
        
      } else if (['grooming_salon', 'trainer', 'dog_walker', 'pet_groomer', 'pet_trainer'].includes(vendor.role_id)) {
        offerings = packages.filter((p: any) => p.isActive);
      } else if (vendor.role_id === 'boarding_resort' || vendor.role_id === 'pet_boarding') {
        // Boarding rooms - will need to create table if needed
        offerings = [];
      } else if (vendor.role_id === 'nutritionist') {
        // Meal products - will need to create table if needed
        offerings = [];
      } else if (['ngo', 'shelter', 'breeder'].includes(vendor.role_id)) {
        // Pet listings - will need to create table if needed
        offerings = [];
      } else if (vendor.role_id === 'pet_store') {
        offerings = products.filter((p: any) => p.isActive);
      }

      return c.json({
        success: true,
        vendor: {
          id: vendor.vendor_id || vendor.id,
          businessName: vendor.business_name,
          roleId: vendor.role_id,
          category: getCategoryFromRole(vendor.role_id),
          description: null, // Will need to add to vendors table if needed
          
          // Contact
          phone: vendor.phone,
          email: vendor.email,
          website: null, // Will need to add to vendors table if needed
          
          // Location
          address: vendor.address,
          city: vendor.city,
          location: vendor.latitude && vendor.longitude ? {
            coordinates: { lat: vendor.latitude, lng: vendor.longitude },
            address: vendor.address
          } : null,
          
          // Media
          logo: null, // Will need to add to vendors table if needed
          images: [], // Will need to add to vendors table if needed
          
          // Ratings
          rating: avgRating,
          totalReviews: reviews.length,
          ratingBreakdown,
          
          // Operating Info
          operatingHours: vendor.operating_hours ? JSON.parse(vendor.operating_hours) : null,
          emergencyAvailable: false, // Will need to add to vendors table if needed
          
          // Social
          socialMedia: {} // Will need to add to vendors table if needed
        },
        offerings,
        staff: staff.map((s: any) => ({
          id: s.id,
          name: s.name,
          role: s.role,
          specialization: s.specialization,
          photo: s.photo
        })),
        recentReviews: reviews
          .sort((a: any, b: any) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
          .slice(0, 5),
        availability: {
          hasAvailability: schedules.length > 0, // Simplified - can enhance with actual schedule check
          totalStaff: staff.length,
          activeSchedules: schedules.length
        }
      });

    } catch (error) {
      console.error('[DISCOVERY] Error:', error);
      return c.json({ error: 'Failed to fetch vendor profile' }, 500);
    }
  });

  // Helper functions
  function getCategoryFromRole(roleId: string): string {
    const roleMap: any = {
      'vet_clinic': 'Veterinary',
      'grooming_salon': 'Grooming',
      'trainer': 'Training',
      'dog_walker': 'Walking',
      'boarding_resort': 'Boarding',
      'nutritionist': 'Nutrition',
      'ngo': 'Adoption',
      'shelter': 'Adoption',
      'breeder': 'Breeder',
      'pet_store': 'Marketplace'
    };
    return roleMap[roleId] || roleId;
  }

  function getAvailableCategories() {
    return [
      { id: 'vet', name: 'Veterinary', icon: '🏥' },
      { id: 'grooming', name: 'Grooming', icon: '✂️' },
      { id: 'training', name: 'Training', icon: '🎓' },
      { id: 'walker', name: 'Walking', icon: '🚶' },
      { id: 'boarding', name: 'Boarding', icon: '🏠' },
      { id: 'nutrition', name: 'Nutrition', icon: '🍖' },
      { id: 'adoption', name: 'Adoption', icon: '❤️' },
      { id: 'marketplace', name: 'Marketplace', icon: '🛍️' }
    ];
  }

  function calculatePriceRange(vendors: any[]) {
    const prices = vendors.flatMap(v => 
      v.featuredOfferings.map((o: any) => o.price || 0)
    ).filter(p => p > 0);

    return prices.length > 0 ? {
      min: Math.min(...prices),
      max: Math.max(...prices)
    } : { min: 0, max: 0 };
  }
}