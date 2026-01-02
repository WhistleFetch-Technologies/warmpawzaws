import { Hono } from "hono";
import { 
  getVendorsRepository,
  getServicesRepository,
  getStaffRepository,
  getReviewsRepository,
  getPackagesRepository,
  getBoardingRoomsRepository,
  getMealPlansRepository,
  getAdoptionRepository,
  getProductsRepository
} from '../../../../supabase/lib/repositories/index';
import { getDbClient, selectQuery } from '../../../../supabase/lib/db';

/**
 * UNIVERSAL SERVICE DISCOVERY
 * Production-ready customer-facing service search
 * 
 * Features:
 * - Multi-category search (Vet, Grooming, Training, Walker, Boarding, etc.)
 * - Location-based filtering
 * - Rating filter
 * - Availability check
 * - Vendor profiles
 * - Unified booking flow
 */

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

      // ✅ SQL: Get all active vendors from repository
      const vendorsRepo = getVendorsRepository();
      const allVendorsRaw = await vendorsRepo.findAllActive();
      const activeVendors = allVendorsRaw.map((v: any) => ({
        id: v.id,
        vendorId: v.id,
        roleId: v.role_id,
        businessName: v.business_name,
        ownerName: v.owner_name,
        address: v.address,
        city: v.city,
        location: v.location,
        isActive: v.is_active,
        rating: v.rating || 0,
        description: v.description,
        phone: v.phone,
        email: v.email,
        logo: v.logo,
        image: v.image,
        operatingHours: v.operating_hours,
        ...v
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
        // Get services/offerings
        let offerings: any[] = [];
        
        // ✅ SQL: GAP #1 FIX: Fetch both vendor services AND staff services
        if (vendor.roleId === 'vet_clinic') {
          // ✅ SQL: Get vendor-level services from vendor_services table
          const db = getDbClient();
          const { data: vendorServicesData } = await db
            .from('vendor_services')
            .select('*')
            .eq('vendor_id', vendor.id)
            .eq('publish_status', 'published')
            .eq('is_enabled', true);
          
          const vendorServices = (vendorServicesData || []).map((s: any) => ({
            id: s.service_id,
            serviceId: s.service_id,
            serviceName: s.service_name,
            name: s.service_name,
            category: s.category,
            categoryName: s.category,
            price: parseFloat(s.price || s.custom_price || '0'),
            duration: s.duration_minutes || s.custom_duration || 30,
            serviceStyle: s.service_style,
            isActive: s.is_enabled,
            type: s.service_style
          }));
          
          // ✅ SQL: Get staff-level services for this vendor
          // First, get all staff members for this vendor
          const staffRepo = getStaffRepository();
          const vendorStaff = await staffRepo.findByVendorId(vendor.id);
          
          // ✅ SQL: Get services for each staff member from staff_services table
          const staffServicesPromises = vendorStaff.map(async (staff: any) => {
            const { data: staffServicesData } = await db
              .from('staff_services')
              .select(`
                *,
                services (*)
              `)
              .eq('staff_id', staff.id)
              .eq('is_active', true);
            
            return (staffServicesData || []).map((ss: any) => ({
              id: ss.service_id,
              serviceId: ss.service_id,
              serviceName: ss.services?.name || ss.service_name || 'Service',
              name: ss.services?.name || ss.service_name || 'Service',
              category: ss.services?.category || ss.category || '',
              categoryName: ss.services?.category || ss.category || '',
              price: parseFloat(ss.price || ss.services?.price || '0'),
              duration: ss.duration_minutes || ss.services?.duration_minutes || 30,
              serviceStyle: ss.service_style || 'at_center',
              isActive: ss.is_active,
              staffId: staff.id,
              type: ss.service_style || 'at_center'
            }));
          });
          
          const allStaffServicesArrays = await Promise.all(staffServicesPromises);
          const vendorStaffServices = allStaffServicesArrays.flat();
          
          // Merge vendor services and staff services
          offerings = [
            ...vendorServices,
            ...vendorStaffServices
          ];
          
          console.log(`[DISCOVERY] Vendor ${vendor.id}: ${vendorServices.length} vendor services + ${vendorStaffServices.length} staff services = ${offerings.length} total`);
          
        } else if (['grooming_salon', 'trainer', 'dog_walker'].includes(vendor.roleId)) {
          // ✅ SQL: Get service packages
          const packagesRepo = getPackagesRepository();
          const packages = await packagesRepo.getVendorPackages(vendor.id);
          offerings = packages.map((p: any) => ({
            id: p.id,
            name: p.name,
            serviceName: p.name,
            price: p.price,
            dayPrice: p.pricePerSession,
            isActive: p.isActive
          }));
        } else if (vendor.roleId === 'boarding_resort') {
          // ✅ SQL: Get boarding rooms
          const boardingRoomsRepo = getBoardingRoomsRepository();
          const rooms = await boardingRoomsRepo.findByVendor(vendor.id, { isActive: true });
          offerings = rooms.map((r: any) => ({
            id: r.id,
            name: r.name,
            price: r.dayPrice,
            dayPrice: r.dayPrice,
            nightPrice: r.nightPrice,
            isActive: r.isActive
          }));
        } else if (vendor.roleId === 'nutritionist') {
          // ✅ SQL: Get meal plans
          const mealPlansRepo = getMealPlansRepository();
          const meals = await mealPlansRepo.findByVendor(vendor.id);
          offerings = meals.filter((m: any) => m.is_active).map((m: any) => ({
            id: m.id,
            name: m.plan_name,
            serviceName: m.plan_name,
            price: 0, // Meal plans may not have direct price
            isActive: m.is_active
          }));
        } else if (['ngo', 'shelter', 'breeder'].includes(vendor.roleId)) {
          // ✅ SQL: Get pet listings (adoption)
          const adoptionRepo = getAdoptionRepository();
          const listings = await adoptionRepo.getAllListings({ 
            vendorId: vendor.id, 
            status: 'available' 
          });
          offerings = listings.map((l: any) => ({
            id: l.listingId || l.id,
            name: l.petName,
            serviceName: l.petName,
            price: l.adoptionFee || 0,
            isActive: l.status === 'available',
            status: l.status
          }));
        } else if (vendor.roleId === 'pet_store') {
          // ✅ SQL: Get marketplace products
          const productsRepo = getProductsRepository();
          const products = await productsRepo.findByVendor(vendor.id, { isActive: true });
          offerings = products.map((p: any) => ({
            id: p.id,
            name: p.name,
            serviceName: p.name,
            price: p.price,
            isActive: p.is_active
          }));
        }

        // ✅ SQL: Calculate availability score from vendor_schedule_slots
        let availabilityScore = 0;
        const db = getDbClient();
        const { data: scheduleSlots } = await db
          .from('vendor_schedule_slots')
          .select('*')
          .eq('vendor_id', vendor.id)
          .eq('is_available', true)
          .limit(10);
        
        if (scheduleSlots && scheduleSlots.length > 0) {
          // Check if there are any active time windows
          const hasActiveWindows = scheduleSlots.some((slot: any) => {
            if (slot.time_windows && Array.isArray(slot.time_windows)) {
              return slot.time_windows.some((w: any) => w.is_enabled === true);
            }
            return slot.is_available === true;
          });
          availabilityScore = hasActiveWindows ? 100 : 50;
        }

        // ✅ SQL: Get reviews
        const reviewsRepo = getReviewsRepository();
        const reviews = await reviewsRepo.findByVendor(vendor.id);
        const avgRating = reviews.length > 0
          ? reviews.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / reviews.length
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

      // ✅ SQL: Get vendor from repository
      const vendorsRepo = getVendorsRepository();
      const vendorRaw = await vendorsRepo.findById(vendorId);
      if (!vendorRaw) {
        return c.json({ error: 'Vendor not found' }, 404);
      }
      
      // Map vendor to expected format
      const vendor: any = {
        ...vendorRaw,
        id: vendorRaw.id,
        vendorId: vendorRaw.id,
        businessName: vendorRaw.business_name,
        roleId: vendorRaw.role_id,
        description: (vendorRaw as any).description || '',
        website: (vendorRaw as any).website || null,
        location: (vendorRaw as any).location || null,
        logo: (vendorRaw as any).logo || null,
        images: (vendorRaw as any).images || [],
        operatingHours: (vendorRaw as any).operating_hours || null,
        emergencyAvailable: (vendorRaw as any).emergency_available || false,
        socialMedia: (vendorRaw as any).social_media || {}
      };

      // ✅ SQL: Get all vendor data in parallel
      const db = getDbClient();
      const [
        vendorServicesData,
        packagesData,
        roomsData,
        mealsData,
        listingsData,
        productsData,
        staffData,
        reviewsData,
        scheduleSlotsData
      ] = await Promise.all([
        // Services from vendor_services table
        db.from('vendor_services')
          .select('*')
          .eq('vendor_id', vendorId)
          .eq('publish_status', 'published')
          .eq('is_enabled', true),
        // Service packages
        getPackagesRepository().getVendorPackages(vendorId),
        // Boarding rooms
        getBoardingRoomsRepository().findByVendor(vendorId, { isActive: true }),
        // Meal plans
        getMealPlansRepository().findByVendor(vendorId),
        // Pet listings (adoption)
        getAdoptionRepository().getAllListings({ vendorId }),
        // Marketplace products
        getProductsRepository().findByVendor(vendorId, { isActive: true }),
        // Staff
        getStaffRepository().findByVendorId(vendorId),
        // Reviews
        getReviewsRepository().findByVendor(vendorId),
        // Schedules from vendor_schedule_slots
        db.from('vendor_schedule_slots')
          .select('*')
          .eq('vendor_id', vendorId)
          .eq('is_available', true)
      ]);
      
      // Map data to expected format
      const services = (vendorServicesData.data || []).map((s: any) => ({
        id: s.service_id,
        serviceId: s.service_id,
        serviceName: s.service_name,
        name: s.service_name,
        category: s.category,
        price: parseFloat(s.price || s.custom_price || '0'),
        duration: s.duration_minutes || s.custom_duration || 30,
        serviceStyle: s.service_style,
        isActive: s.is_enabled
      }));
      
      const packages = packagesData.map((p: any) => ({
        ...p,
        isActive: p.isActive
      }));
      
      const rooms = roomsData.map((r: any) => ({
        ...r,
        isActive: r.isActive
      }));
      
      const meals = mealsData.filter((m: any) => m.is_active).map((m: any) => ({
        ...m,
        isActive: m.is_active
      }));
      
      const listings = listingsData.map((l: any) => ({
        ...l,
        isActive: l.status === 'available',
        status: l.status
      }));
      
      const products = productsData.map((p: any) => ({
        ...p,
        isActive: p.is_active
      }));
      
      const staff = staffData.map((s: any) => ({
        id: s.id,
        name: s.full_name || s.name,
        role: s.role,
        specialization: s.specialization,
        photo: s.photo || s.image
      }));
      
      const reviews = reviewsData;
      
      const schedules = (scheduleSlotsData.data || []).map((s: any) => ({
        ...s,
        isActive: s.is_available,
        vacationMode: false
      }));

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
        // ✅ SQL: GAP #1 FIX: Include both vendor services AND staff services in profile
        const vendorServices = services.filter((s: any) => s.isActive);
        
        // ✅ SQL: Get staff-level services from staff_services table
        const db = getDbClient();
        const staffServicesPromises = staff.map(async (staffMember: any) => {
          const { data: staffServicesData } = await db
            .from('staff_services')
            .select(`
              *,
              services (*)
            `)
            .eq('staff_id', staffMember.id)
            .eq('is_active', true);
          
          return (staffServicesData || []).map((ss: any) => ({
            id: ss.service_id,
            serviceId: ss.service_id,
            serviceName: ss.services?.name || ss.service_name || 'Service',
            name: ss.services?.name || ss.service_name || 'Service',
            category: ss.services?.category || ss.category || '',
            price: parseFloat(ss.price || ss.services?.price || '0'),
            duration: ss.duration_minutes || ss.services?.duration_minutes || 30,
            serviceStyle: ss.service_style || 'at_center',
            isActive: ss.is_active,
            staffId: staffMember.id
          }));
        });
        
        const allStaffServicesArrays = await Promise.all(staffServicesPromises);
        const staffServices = allStaffServicesArrays.flat();
        
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