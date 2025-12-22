import { Hono } from "npm:hono";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import * as kv from './kv_store.tsx';

/**
 * UNIVERSAL SERVICE DISCOVERY
 * Production-ready customer-facing service search
 * ✅ UPDATED: Now uses SQL database for service queries
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

      // Get all active vendors
      const allVendors = await kv.getByPrefix('vendor:');
      const activeVendors = allVendors.filter((v: any) => v.isActive);

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
              // Transform SQL services to match expected format
              offerings = sqlServices.map((service: any) => ({
                id: service.service_id || service.id,
                serviceId: service.service_id || service.id,
                serviceName: service.name,
                name: service.name,
                description: service.description,
                price: service.vendor_services?.[0]?.custom_price || service.base_price,
                duration: service.vendor_services?.[0]?.custom_duration || service.duration_minutes,
                category: service.category,
                serviceStyle: service.service_style,
                isActive: service.is_active,
                isLive: service.is_live,
                publishStatus: service.publish_status,
                staffId: service.staff_services?.[0]?.staff_id || null
              }));

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
          // Fallback to KV if SQL fails
          const vendorServiceIds = await kv.get(`vendor:${vendor.id}:services`) || [];
          const vendorServices = await Promise.all(
            vendorServiceIds.map(async (sid: string) => {
              const service = await kv.get(`service:${sid}`);
              return service || null;
            })
          );
          offerings = vendorServices.filter(Boolean);
        }
        
        // Fallback to KV for non-service offerings (packages, rooms, etc.)
        if (offerings.length === 0) {
          if (['grooming_salon', 'trainer', 'dog_walker'].includes(vendor.roleId)) {
            offerings = await kv.get(`vendor:${vendor.id}:service_packages`) || [];
          } else if (vendor.roleId === 'boarding_resort') {
            offerings = await kv.get(`vendor:${vendor.id}:boarding_rooms`) || [];
          } else if (vendor.roleId === 'nutritionist') {
            offerings = await kv.get(`vendor:${vendor.id}:meal_products`) || [];
          } else if (['ngo', 'shelter', 'breeder'].includes(vendor.roleId)) {
            offerings = await kv.get(`vendor:${vendor.id}:pet_listings`) || [];
          } else if (vendor.roleId === 'pet_store') {
            offerings = await kv.get(`vendor:${vendor.id}:marketplace_products`) || [];
          }
        }

        // Calculate availability score
        let availabilityScore = 0;
        const schedules = await kv.get(`vendor:${vendor.id}:staff_schedules`) || [];
        
        if (schedules.length > 0) {
          const today = new Date().toISOString().split('T')[0];
          const todaySchedules = schedules.filter((s: any) => 
            !s.vacationMode && s.isActive
          );
          availabilityScore = todaySchedules.length > 0 ? 100 : 50;
        }

        // Get reviews
        const reviews = await kv.get(`vendor:${vendor.id}:reviews`) || [];
        const avgRating = reviews.length > 0
          ? reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length
          : 0;

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

      const vendor = await kv.get(`vendor:${vendorId}`);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      // Get all vendor data
      const [
        services,
        packages,
        rooms,
        meals,
        listings,
        products,
        staff,
        reviews,
        schedules
      ] = await Promise.all([
        kv.get(`vendor:${vendorId}:services`) || [],
        kv.get(`vendor:${vendorId}:service_packages`) || [],
        kv.get(`vendor:${vendorId}:boarding_rooms`) || [],
        kv.get(`vendor:${vendorId}:meal_products`) || [],
        kv.get(`vendor:${vendorId}:pet_listings`) || [],
        kv.get(`vendor:${vendorId}:marketplace_products`) || [],
        kv.get(`vendor:${vendorId}:staff`) || [],
        kv.get(`vendor:${vendorId}:reviews`) || [],
        kv.get(`vendor:${vendorId}:staff_schedules`) || []
      ]);

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

      // Get offerings based on vendor type
      let offerings: any[] = [];
      
      if (vendor.roleId === 'vet_clinic') {
        // ✅ GAP #1 FIX: Include both vendor services AND staff services in profile
        const vendorServices = services.filter((s: any) => s.isActive);
        
        // Get staff-level services
        const staffServicesPromises = staff.map(async (staffId: string) => {
          const staffServices = await kv.getByPrefix(`staff:${staffId}:service:`);
          return staffServices || [];
        });
        
        const allStaffServicesArrays = await Promise.all(staffServicesPromises);
        const staffServices = allStaffServicesArrays
          .flat()
          .filter((s: any) => s && s.isActive);
        
        // Merge both
        offerings = [...vendorServices, ...staffServices];
        
        console.log(`[DISCOVERY] Profile ${vendorId}: ${vendorServices.length} vendor + ${staffServices.length} staff = ${offerings.length} total services`);
        
      } else if (['grooming_salon', 'trainer', 'dog_walker'].includes(vendor.roleId)) {
        offerings = packages.filter((p: any) => p.isActive);
      } else if (vendor.roleId === 'boarding_resort') {
        offerings = rooms.filter((r: any) => r.isActive);
      } else if (vendor.roleId === 'nutritionist') {
        offerings = meals.filter((m: any) => m.isActive);
      } else if (['ngo', 'shelter', 'breeder'].includes(vendor.roleId)) {
        offerings = listings.filter((l: any) => l.isActive && l.status === 'available');
      } else if (vendor.roleId === 'pet_store') {
        offerings = products.filter((p: any) => p.isActive);
      }

      return c.json({
        success: true,
        vendor: {
          id: vendor.id,
          businessName: vendor.businessName,
          roleId: vendor.roleId,
          category: getCategoryFromRole(vendor.roleId),
          description: vendor.description || '',
          
          // Contact
          phone: vendor.phone,
          email: vendor.email,
          website: vendor.website,
          
          // Location
          address: vendor.address,
          city: vendor.city,
          location: vendor.location,
          
          // Media
          logo: vendor.logo,
          images: vendor.images || [],
          
          // Ratings
          rating: avgRating,
          totalReviews: reviews.length,
          ratingBreakdown,
          
          // Operating Info
          operatingHours: vendor.operatingHours || null,
          emergencyAvailable: vendor.emergencyAvailable || false,
          
          // Social
          socialMedia: vendor.socialMedia || {}
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
          hasAvailability: schedules.some((s: any) => s.isActive && !s.vacationMode),
          totalStaff: staff.length,
          activeSchedules: schedules.filter((s: any) => s.isActive).length
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