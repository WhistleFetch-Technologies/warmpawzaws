/**
 * Universal Customer Search & Listing API - SQL VERSION
 * Works dynamically for ALL vendor roles and service categories
 * Supports filtering by service style (at_center, at_home, tele)
 * 
 * ✅ MIGRATED TO SQL: All KV operations replaced with SQL repositories
 * 
 * ARCHITECTURE DECISION:
 * - at_center services → Returns CENTERS/FACILITIES (customer selects venue)
 * - at_home/tele services → Returns STAFF (customer selects individual provider)
 * 
 * Date: 2025-01-27
 * Migration: KV to SQL (27 KV operations → 0)
 */

import { Hono } from 'npm:hono';
import { getRolesRepository } from '../../lib/repositories/roles.ts';
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { getStaffRepository } from '../../lib/repositories/staff.ts';
import { getReviewsRepository } from '../../lib/repositories/reviews.ts';
import { getSchedulingRepository } from '../../lib/repositories/scheduling.ts';
import { getDbClient } from '../../lib/db.ts';
import { getPrimarySpecialization, getAllSpecializations } from './specialization-mapping.tsx';
import { calculateDistance } from './schedule-utils.tsx';

/**
 * Generate time slots from a time window
 */
function generateSlotsFromTimeWindow(startTime: string, endTime: string, durationMinutes: number = 30): any[] {
  const slots: any[] = [];
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  
  let currentHour = startHour;
  let currentMin = startMin;
  
  while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
    const timeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`;
    slots.push({
      time: timeStr,
      status: 'available'
    });
    
    currentMin += durationMinutes;
    if (currentMin >= 60) {
      currentMin -= 60;
      currentHour += 1;
    }
  }
  
  return slots;
}

/**
 * ✅ DYNAMIC ROLE MAPPING: Load role configurations from SQL (master data)
 * Roles are independent of region - all active roles are available
 */
async function getDynamicRoleMapping(): Promise<Record<string, string[]>> {
  try {
    // ✅ SQL: Get all active roles from roles table (master data)
    const rolesRepo = getRolesRepository();
    const allRoles = await rolesRepo.findActive();
    
    // Build dynamic mapping by serviceCategory
    const mapping: Record<string, string[]> = {};
    
    for (const role of allRoles) {
      const config = role.config || {};
      const serviceCategory = config.serviceCategory || role.serviceCategory;
      const roleId = role.name || role.id;
      
      if (serviceCategory && roleId) {
        if (!mapping[serviceCategory]) {
          mapping[serviceCategory] = [];
        }
        mapping[serviceCategory].push(roleId);
      }
    }
    
    console.log('📋 [DYNAMIC-ROLES] Loaded role mapping from SQL:', mapping);
    return mapping;
  } catch (error) {
    console.error('❌ [DYNAMIC-ROLES] Failed to load roles from SQL:', error);
    // Fallback to basic mapping
    return {
      'veterinary_services': ['veterinarian', 'pet_clinic', 'vet_clinic'],
      'grooming_services': ['pet_groomer'],
      'training_services': ['pet_trainer'],
      'walking_services': ['pet_walker'],
      'boarding_services': ['pet_boarder']
    };
  }
}

/**
 * ✅ BACKWARDS COMPATIBLE: Static fallback mapping for emergency
 */
function getStaticFallbackMapping(serviceCategory: string): string[] {
  const categoryMap: Record<string, string[]> = {
    'veterinary_services': ['veterinarian', 'pet_clinic', 'vet_clinic'],
    'grooming_services': ['pet_groomer'],
    'training_services': ['pet_trainer'],
    'walking_services': ['pet_walker'],
    'boarding_services': ['pet_boarder'],
    'photography_services': ['pet_photographer'],
    'pharmacy_services': ['pet_pharmacy'],
    'behaviour_services': ['pet_behaviourist'],
    'daycare_services': ['pet_daycare'],
    'cremation_services': ['pet_cremation'],
    'adoption_services': ['pet_adoption_center'],
    'insurance_services': ['pet_insurance_provider'],
    'relocation_services': ['pet_relocation_service'],
    'sitting_services': ['pet_sitter'],
    'general_services': ['service_provider']
  };
  
  return categoryMap[serviceCategory] || [];
}

/**
 * Register Universal Customer Search Routes
 */
export function registerUniversalCustomerSearch(app: Hono) {

/**
 * UNIVERSAL SEARCH ENDPOINT
 * GET /make-server-3dd53475/universal/search
 * 
 * Query Parameters:
 * - serviceCategory: veterinary_services, grooming_services, training_services, etc.
 * - serviceStyle: at_center, at_home, tele (optional - returns all if not specified)
 * - roleId: specific role filter (optional)
 * - searchQuery: search by name, specialization (optional)
 * - feeMin, feeMax: price range filter
 * - availableToday: only show available today
 * - sortBy: relevance, fee_low, fee_high, rating, experience
 * - limit: results per page (default: 20)
 * - offset: pagination offset
 */
app.get('/make-server-3dd53475/universal/search', async (c) => {
  try {
    // Extract query parameters
    const serviceCategory = c.req.query('serviceCategory'); // Required
    const serviceStyle = c.req.query('serviceStyle'); // Optional: at_center, at_home, tele
    const roleId = c.req.query('roleId'); // Optional
    const searchQuery = c.req.query('query') || '';
    const feeMin = parseInt(c.req.query('feeMin') || '0');
    const feeMax = parseInt(c.req.query('feeMax') || '999999');
    const availableToday = c.req.query('availableToday') === 'true';
    const sortBy = c.req.query('sortBy') || 'relevance';
    const limit = parseInt(c.req.query('limit') || '20');
    const offset = parseInt(c.req.query('offset') || '0');
    
    // ✅ NEW: Customer location for distance calculation
    const customerLat = parseFloat(c.req.query('lat') || '0');
    const customerLon = parseFloat(c.req.query('lon') || '0');

    console.log(`\n🔍 ===== UNIVERSAL CUSTOMER SEARCH (SQL) =====`);
    console.log(`📋 Service Category: ${serviceCategory}`);
    console.log(`🎨 Service Style: ${serviceStyle || 'ALL'}`);
    console.log(`🏷️ Role ID: ${roleId || 'ALL'}`);
    console.log(`🔎 Search Query: "${searchQuery}"`);
    console.log(`💰 Fee Range: ₹${feeMin} - ₹${feeMax}`);
    console.log(`📅 Available Today Only: ${availableToday}`);
    console.log(`📍 Customer Location: ${customerLat}, ${customerLon}`);

    if (!serviceCategory) {
      return c.json({
        success: false,
        error: 'serviceCategory is required',
        message: 'Please specify serviceCategory (e.g., veterinary_services, grooming_services)'
      }, 400);
    }

    // ✅ DYNAMIC ROLE MAPPING: Load role configurations from SQL (master data, no region dependency)
    const dynamicRoleMapping = await getDynamicRoleMapping();
    const allowedRoleIds = dynamicRoleMapping[serviceCategory] || getStaticFallbackMapping(serviceCategory);
    console.log(`🔧 Mapped "${serviceCategory}" to roles:`, allowedRoleIds);

    // ✅ SQL: Get all approved vendors for this service category
    const vendorsRepo = getVendorsRepository();
    const allVendors = await vendorsRepo.findAll({ status: 'approved' });
    console.log(`📊 Total vendors in DB: ${allVendors.length}`);

    // ✅ CRITICAL FIX: Filter by roleId instead of serviceCategory
    let vendors = allVendors.filter((v: any) => 
      v.status === 'approved' &&
      v.is_active === true &&
      allowedRoleIds.includes(v.role_id) // ✅ FIXED: Match by role_id instead of serviceCategory
    );

    console.log(`📊 Approved vendors in category "${serviceCategory}": ${vendors.length}`);

    // Apply role filter if specified
    if (roleId) {
      vendors = vendors.filter((v: any) => v.role_id === roleId);
      console.log(`📊 After role filter (${roleId}): ${vendors.length}`);
    }

    // CRITICAL DECISION: Return CENTERS or STAFF based on serviceStyle
    if (serviceStyle === 'at_center') {
      console.log(`🏢 ===== RETURNING CENTERS (at_center mode) =====`);
      return await returnCenters(c, vendors, serviceCategory, serviceStyle, searchQuery, feeMin, feeMax, availableToday, sortBy, limit, offset, customerLat, customerLon);
    } else {
      console.log(`👤 ===== RETURNING STAFF (at_home/tele mode) =====`);
      return await returnStaff(c, vendors, serviceCategory, serviceStyle, searchQuery, feeMin, feeMax, availableToday, sortBy, limit, offset, customerLat, customerLon);
    }

  } catch (error) {
    console.error('❌ Universal search error:', error);
    return c.json({
      success: false,
      error: 'Search failed',
      message: String(error),
      results: [],
      total: 0
    }, 500);
  }
});

/**
 * RETURN CENTERS/FACILITIES (for at_center services)
 * Customer selects WHICH CENTER to visit, not which staff member
 */
async function returnCenters(
  c: any,
  vendors: any[],
  serviceCategory: string,
  serviceStyle: string,
  searchQuery: string,
  feeMin: number,
  feeMax: number,
  availableToday: boolean,
  sortBy: string,
  limit: number,
  offset: number,
  customerLat: number,
  customerLon: number
) {
  const centers: any[] = [];
  const db = getDbClient();
  const staffRepo = getStaffRepository();
  const reviewsRepo = getReviewsRepository();
  const schedulingRepo = getSchedulingRepository();

  for (const vendor of vendors) {
    // ✅ SQL: Get at_center services for this vendor
    const { data: vendorServicesData } = await db
      .from('vendor_services')
      .select('*')
      .eq('vendor_id', vendor.id)
      .eq('service_style', 'at_center')
      .eq('publish_status', 'published')
      .eq('is_enabled', true);
    
    const publishedServices = vendorServicesData || [];

    if (publishedServices.length === 0) {
      console.log(`⏭️  ${vendor.business_name || vendor.owner_name}: No published at_center services`);
      continue;
    }

    // ✅ SQL: Get staff for this vendor
    const activeStaff = await staffRepo.findByVendorId(vendor.id);

    // Calculate average fee from all active staff
    const avgFee = activeStaff.length > 0
      ? activeStaff.reduce((sum, s) => sum + (s.consultationFee || 0), 0) / activeStaff.length
      : (publishedServices[0]?.price || 0);

    // Apply fee filter
    if (avgFee < feeMin || avgFee > feeMax) {
      console.log(`⏭️  ${vendor.business_name || vendor.owner_name}: Fee ₹${avgFee} outside range`);
      continue;
    }

    // ✅ SQL: Get aggregated reviews/ratings from all staff
    let totalRating = 0;
    let totalReviews = 0;
    const allReviews: any[] = [];

    for (const staff of activeStaff) {
      // ✅ SQL: Get reviews for this staff
      const { data: reviewsData } = await db
        .from('reviews')
        .select('*')
        .eq('staff_id', staff.id)
        .order('created_at', { ascending: false });
      
      const reviewsArray = reviewsData || [];
      allReviews.push(...reviewsArray);
      totalReviews += reviewsArray.length;
      
      if (reviewsArray.length > 0) {
        const staffRating = reviewsArray.reduce((sum: number, r: any) => 
          sum + (r.rating || 0), 0) / reviewsArray.length;
        totalRating += staffRating;
      }
    }

    const centerRating = activeStaff.length > 0 && totalRating > 0
      ? totalRating / activeStaff.length
      : 0;

    // ✅ SQL: Check availability - find earliest slot from ANY staff
    let nextAvailable = null;
    let isAvailableToday = false;

    if (activeStaff.length > 0) {
      try {
        // Check next 7 days
        for (let i = 0; i < 7; i++) {
          const date = new Date(Date.now() + i * 86400000).toISOString().split('T')[0];
          
          // Check each staff member for availability
          for (const staff of activeStaff) {
            // ✅ SQL: Get availability for this staff on this date
            // Try staff_availability table first (date-based)
            const { data: availabilityData } = await db
              .from('staff_availability')
              .select('*')
              .eq('staff_id', staff.id)
              .eq('date', date)
              .eq('is_available', true)
              .limit(1);
            
            if (availabilityData && availabilityData.length > 0) {
              const availability = availabilityData[0];
              // Use start_time as the available time
              nextAvailable = {
                date,
                time: availability.start_time,
                isToday: i === 0,
                isTomorrow: i === 1,
                daysFromNow: i,
                staffId: staff.id,
                staffName: staff.fullName
              };
              isAvailableToday = i === 0;
              break;
            } else {
              // Fallback: Check vendor_schedule_slots for day of week
              const dateObj = new Date(date);
              const dayOfWeek = dateObj.getDay();
              const { data: scheduleData } = await db
                .from('vendor_schedule_slots')
                .select('*')
                .eq('vendor_id', staff.vendorId)
                .eq('staff_id', staff.id)
                .eq('day_of_week', dayOfWeek)
                .eq('is_available', true)
                .limit(1);
              
              if (scheduleData && scheduleData.length > 0) {
                const schedule = scheduleData[0];
                // Check time_windows JSONB for enabled windows
                if (schedule.time_windows && Array.isArray(schedule.time_windows)) {
                  const enabledWindow = schedule.time_windows.find((w: any) => w.is_enabled === true);
                  if (enabledWindow) {
                    nextAvailable = {
                      date,
                      time: enabledWindow.start_time || schedule.start_time,
                      isToday: i === 0,
                      isTomorrow: i === 1,
                      daysFromNow: i,
                      staffId: staff.id,
                      staffName: staff.fullName
                    };
                    isAvailableToday = i === 0;
                    break;
                  }
                }
              }
            }
          }
          
          if (nextAvailable) break;
        }
      } catch (err) {
        console.warn(`⚠️ Could not fetch availability for ${vendor.id}:`, err);
      }
    }

    // Apply availableToday filter
    if (availableToday && !isAvailableToday) {
      console.log(`⏭️  ${vendor.business_name || vendor.owner_name}: Not available today`);
      continue;
    }

    // Apply search query filter
    if (searchQuery && searchQuery.length > 0) {
      const searchLower = searchQuery.toLowerCase();
      const nameMatch = vendor.business_name?.toLowerCase().includes(searchLower) ||
                       vendor.owner_name?.toLowerCase().includes(searchLower);
      const addressMatch = vendor.address?.toLowerCase().includes(searchLower) ||
                          vendor.city?.toLowerCase().includes(searchLower);
      const servicesMatch = publishedServices.some((s: any) =>
        s.service_name?.toLowerCase().includes(searchLower)
      );
      
      if (!nameMatch && !addressMatch && !servicesMatch) {
        continue;
      }
    }

    // ✅ Calculate distance if coordinates available
    let distance = null;
    const vendorLat = parseFloat(String(vendor.latitude || '0'));
    const vendorLon = parseFloat(String(vendor.longitude || '0'));
    if (customerLat && customerLon && vendorLat && vendorLon) {
      distance = calculateDistance(customerLat, customerLon, vendorLat, vendorLon);
      distance = parseFloat(distance.toFixed(1)); // Round to 1 decimal
    }

    // Build center object
    const centerObj = {
      id: vendor.id,
      vendorId: vendor.id,
      type: 'center',
      name: vendor.business_name || vendor.owner_name,
      businessName: vendor.business_name || vendor.owner_name,
      fullName: vendor.owner_name,
      photo: vendor.business_logo || null,
      
      // Location
      address: vendor.address || '',
      city: vendor.city || '',
      state: vendor.state || '',
      pincode: vendor.pincode || '',
      phone: vendor.phone || '',
      latitude: vendorLat || null,
      longitude: vendorLon || null,
      distance: distance, // ✅ Distance in km
      
      // Services
      services: publishedServices.map((s: any) => ({
        serviceId: s.service_id,
        serviceName: s.service_name,
        price: s.price,
        duration: s.duration_minutes,
        category: s.category,
        subCategory: s.sub_category,
        serviceStyle: s.service_style
      })),
      serviceCount: publishedServices.length,
      
      // Staff
      staffCount: activeStaff.length,
      staff: activeStaff.map(s => ({
        id: s.id,
        name: s.fullName || s.name,
        fullName: s.fullName || s.name,
        photo: s.photo,
        specialization: getPrimarySpecialization(s),
        specializations: getAllSpecializations(s),
        degree: s.degree,
        experience: s.experience || s.yearsOfExperience || 0,
        yearsOfExperience: s.yearsOfExperience || s.experience || 0,
        consultationFee: s.consultationFee,
        rating: s.rating || 0,
        reviewCount: s.reviewCount || 0,
        bio: s.bio || '',
        gender: s.gender || '',
        languages: s.languages || ['English', 'Hindi']
      })),
      
      // Pricing
      averageFee: Math.round(avgFee),
      feeRange: activeStaff.length > 1 ? {
        min: Math.min(...activeStaff.map(s => s.consultationFee || 0)),
        max: Math.max(...activeStaff.map(s => s.consultationFee || 0))
      } : null,
      
      // Ratings
      rating: isNaN(centerRating) ? 0 : parseFloat(centerRating.toFixed(1)),
      reviewCount: totalReviews,
      topReviews: allReviews.slice(0, 3).map((r: any) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        customerId: r.customer_id,
        createdAt: r.created_at
      })),
      
      // Availability
      nextAvailable,
      isAvailableToday,
      hasAvailability: nextAvailable !== null,
      
      // Role info
      roleId: vendor.role_id,
      roleName: vendor.role_id, // Would need to join with roles table for name
      serviceCategory: serviceCategory,
      
      // Metadata
      isActive: vendor.is_active,
      status: vendor.status,
      establishedYear: vendor.experience_years || null,
      certifications: [] // Would need to query certifications table
    };

    centers.push(centerObj);
    console.log(`✅ ${centerObj.name}: ${centerObj.serviceCount} services, ${centerObj.staffCount} staff, Rating ${centerObj.rating}`);
  }

  console.log(`📊 Total centers with published services: ${centers.length}`);

  // Sort centers
  let sortedCenters = [...centers];
  
  switch (sortBy) {
    case 'fee_low':
      sortedCenters.sort((a, b) => a.averageFee - b.averageFee);
      break;
    case 'fee_high':
      sortedCenters.sort((a, b) => b.averageFee - a.averageFee);
      break;
    case 'rating':
      sortedCenters.sort((a, b) => b.rating - a.rating);
      break;
    case 'relevance':
    default:
      // Sort by: available today > rating > service count
      sortedCenters.sort((a, b) => {
        if (a.isAvailableToday !== b.isAvailableToday) {
          return b.isAvailableToday ? 1 : -1;
        }
        if (Math.abs(a.rating - b.rating) > 0.5) {
          return b.rating - a.rating;
        }
        return b.serviceCount - a.serviceCount;
      });
      break;
  }

  // Paginate
  const total = sortedCenters.length;
  const paginatedResults = sortedCenters.slice(offset, offset + limit);

  console.log(`✅ Returning ${paginatedResults.length} centers (${total} total)`);

  return c.json({
    success: true,
    results: paginatedResults,
    total,
    resultType: 'centers',
    pagination: {
      limit,
      offset,
      hasMore: offset + limit < total,
      totalPages: Math.ceil(total / limit),
      currentPage: Math.floor(offset / limit) + 1
    },
    filters: {
      serviceCategory,
      serviceStyle,
      roleId: c.req.query('roleId') || 'all',
      searchQuery,
      feeRange: { min: feeMin, max: feeMax },
      availableToday,
      sortBy
    }
  });
}

/**
 * RETURN STAFF (for at_home/tele services)
 * Customer selects WHICH STAFF MEMBER provides the service
 */
async function returnStaff(
  c: any,
  vendors: any[],
  serviceCategory: string,
  serviceStyle: string | undefined,
  searchQuery: string,
  feeMin: number,
  feeMax: number,
  availableToday: boolean,
  sortBy: string,
  limit: number,
  offset: number,
  customerLat: number,
  customerLon: number
) {
  let allStaff: any[] = [];
  const db = getDbClient();
  const staffRepo = getStaffRepository();
  const reviewsRepo = getReviewsRepository();
  
  for (const vendor of vendors) {
    // ✅ SQL: Get vendor's staff list
    const vendorStaff = await staffRepo.findByVendorId(vendor.id);
    
    for (const staff of vendorStaff) {
      if (staff.isActive) {
        // Attach vendor info to staff
        staff.vendorInfo = {
          id: vendor.id,
          businessName: vendor.business_name || vendor.owner_name,
          fullName: vendor.owner_name,
          address: vendor.address,
          city: vendor.city,
          state: vendor.state,
          pincode: vendor.pincode,
          phone: vendor.phone,
          latitude: vendor.latitude,
          longitude: vendor.longitude,
          roleId: vendor.role_id,
          roleName: vendor.role_id
        };
        allStaff.push(staff);
      }
    }
  }

  console.log(`📊 Total active staff found: ${allStaff.length}`);

  // ✅ SQL: Filter by service style if specified
  if (serviceStyle) {
    console.log(`🎨 Filtering by service style: ${serviceStyle}`);
    
    const staffWithMatchingServices: any[] = [];
    
    for (const staff of allStaff) {
      // ✅ SQL: Get staff services with matching style
      const { data: staffServicesData } = await db
        .from('staff_services')
        .select('*')
        .eq('staff_id', staff.id)
        .eq('service_style', serviceStyle)
        .eq('is_active', true);
      
      const matchingServices = staffServicesData || [];

      if (matchingServices.length > 0) {
        staff.matchingServicesCount = matchingServices.length;
        staff.matchingServices = matchingServices;
        staffWithMatchingServices.push(staff);
      }
    }

    allStaff = staffWithMatchingServices;
    console.log(`📊 Staff with ${serviceStyle} services: ${allStaff.length}`);
  } else {
    // No service style filter - get ALL services for each staff
    for (const staff of allStaff) {
      // ✅ SQL: Get all active services for this staff
      const { data: staffServicesData } = await db
        .from('staff_services')
        .select('*')
        .eq('staff_id', staff.id)
        .eq('is_active', true);
      
      const activeServices = staffServicesData || [];
      
      staff.matchingServices = activeServices;
      staff.matchingServicesCount = activeServices.length;
    }
  }

  // Remove staff with no services
  allStaff = allStaff.filter((s: any) => s.matchingServicesCount > 0);
  console.log(`📊 Staff with services: ${allStaff.length}`);

  // Apply search query filter
  if (searchQuery && searchQuery.length > 0) {
    const searchLower = searchQuery.toLowerCase();
    allStaff = allStaff.filter((staff: any) => {
      const nameMatch = staff.fullName?.toLowerCase().includes(searchLower) ||
                       staff.name?.toLowerCase().includes(searchLower);
      const specializationMatch = staff.specialization?.toLowerCase().includes(searchLower);
      const degreeMatch = staff.degree?.toLowerCase().includes(searchLower);
      const businessMatch = staff.vendorInfo?.businessName?.toLowerCase().includes(searchLower);
      
      return nameMatch || specializationMatch || degreeMatch || businessMatch;
    });
    console.log(`📊 After search filter: ${allStaff.length}`);
  }

  // Apply fee range filter
  allStaff = allStaff.filter((staff: any) => {
    const fee = staff.consultationFee || 0;
    return fee >= feeMin && fee <= feeMax;
  });
  console.log(`📊 After fee filter: ${allStaff.length}`);

  // ✅ SQL: Check availability if requested
  if (availableToday) {
    const today = new Date().toISOString().split('T')[0];
    const db = getDbClient();
    
    const availableStaff: any[] = [];
    
    for (const staff of allStaff) {
      // ✅ SQL: Get availability for today
      const { data: availabilityData } = await db
        .from('staff_availability')
        .select('*')
        .eq('staff_id', staff.id)
        .eq('date', today)
        .eq('is_available', true)
        .limit(1);
      
      if (availabilityData && availabilityData.length > 0) {
        // If availability record exists, staff is available
        availableStaff.push(staff);
      } else {
        // Fallback: Check vendor_schedule_slots for today's day of week
        const dateObj = new Date(today);
        const dayOfWeek = dateObj.getDay();
        const { data: scheduleData } = await db
          .from('vendor_schedule_slots')
          .select('*')
          .eq('vendor_id', staff.vendorId)
          .or(`staff_id.is.null,staff_id.eq.${staff.id}`)
          .eq('day_of_week', dayOfWeek)
          .eq('is_available', true)
          .limit(1);
        
        if (scheduleData && scheduleData.length > 0) {
          const schedule = scheduleData[0];
          // Check if any time window is enabled
          if (schedule.time_windows && Array.isArray(schedule.time_windows)) {
            const hasEnabledWindow = schedule.time_windows.some((w: any) => w.is_enabled === true);
            if (hasEnabledWindow) {
              availableStaff.push(staff);
            }
          } else {
            // No time_windows, assume available if is_available is true
            availableStaff.push(staff);
          }
        }
      }
    }
    
    allStaff = availableStaff;
    console.log(`📊 Available today: ${allStaff.length}`);
  }

  // ✅ SQL: Enrich with reviews and ratings
  const enrichedStaff = await Promise.all(
    allStaff.map(async (staff: any) => {
      // ✅ SQL: Get reviews
      const { data: reviewsData } = await db
        .from('reviews')
        .select('*')
        .eq('staff_id', staff.id)
        .order('created_at', { ascending: false });
      
      const reviewsArray = reviewsData || [];
      const rating = reviewsArray.length > 0
        ? reviewsArray.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / reviewsArray.length
        : 0;

      // ✅ SQL: Get next available slot
      let nextAvailable = null;
      try {
        const db = getDbClient();
        // Check next 7 days for availability
        for (let i = 0; i < 7; i++) {
          const date = new Date(Date.now() + i * 86400000).toISOString().split('T')[0];
          const { data: availabilityData } = await db
            .from('staff_availability')
            .select('*')
            .eq('staff_id', staff.id)
            .eq('date', date)
            .eq('is_available', true)
            .limit(1);
          
          if (availabilityData && availabilityData.length > 0) {
            const availability = availabilityData[0];
            nextAvailable = {
              date,
              time: availability.start_time,
              isToday: i === 0,
              isTomorrow: i === 1,
              daysFromNow: i
            };
            break;
          } else {
            // Fallback: Check vendor_schedule_slots
            const dateObj = new Date(date);
            const dayOfWeek = dateObj.getDay();
            const { data: scheduleData } = await db
              .from('vendor_schedule_slots')
              .select('*')
              .eq('vendor_id', staff.vendorId)
              .or(`staff_id.is.null,staff_id.eq.${staff.id}`)
              .eq('day_of_week', dayOfWeek)
              .eq('is_available', true)
              .limit(1);
            
            if (scheduleData && scheduleData.length > 0) {
              const schedule = scheduleData[0];
              if (schedule.time_windows && Array.isArray(schedule.time_windows)) {
                const enabledWindow = schedule.time_windows.find((w: any) => w.is_enabled === true);
                if (enabledWindow) {
                  nextAvailable = {
                    date,
                    time: enabledWindow.start_time || schedule.start_time,
                    isToday: i === 0,
                    isTomorrow: i === 1,
                    daysFromNow: i
                  };
                  break;
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn(`⚠️ Could not fetch availability for ${staff.id}`);
      }

      // ✅ Calculate distance from vendor coordinates
      let distance = null;
      const vendorLat = parseFloat(String(staff.vendorInfo?.latitude || '0'));
      const vendorLon = parseFloat(String(staff.vendorInfo?.longitude || '0'));
      if (customerLat && customerLon && vendorLat && vendorLon) {
        distance = calculateDistance(customerLat, customerLon, vendorLat, vendorLon);
        distance = parseFloat(distance.toFixed(1));
      }

      return {
        id: staff.id,
        staffId: staff.id,
        type: 'staff',
        name: staff.fullName || staff.name,
        fullName: staff.fullName || staff.name,
        photo: staff.photo || null,
        specialization: getPrimarySpecialization(staff),
        specializations: getAllSpecializations(staff),
        degree: staff.degree || '',
        experience: staff.experience || staff.yearsOfExperience || 0,
        yearsOfExperience: staff.yearsOfExperience || staff.experience || 0,
        consultationFee: staff.consultationFee || 0,
        gender: staff.gender || '',
        languages: staff.languages || ['English', 'Hindi'],
        bio: staff.bio || '',
        rating: isNaN(rating) ? 0 : parseFloat(rating.toFixed(1)),
        reviewCount: reviewsArray.length,
        
        // Vendor/clinic info
        vendorId: staff.vendorId,
        clinicId: staff.vendorId,
        clinicName: staff.vendorInfo?.businessName || staff.vendorInfo?.fullName,
        clinicAddress: staff.vendorInfo?.address || '',
        clinicCity: staff.vendorInfo?.city || '',
        clinicPhone: staff.vendorInfo?.phone || '',
        clinicLatitude: vendorLat || null,
        clinicLongitude: vendorLon || null,
        distance: distance,
        
        // Service info
        serviceCount: staff.matchingServicesCount || 0,
        services: staff.matchingServices || [],
        
        // Availability
        nextAvailable,
        isAvailableToday: nextAvailable?.isToday || false,
        
        // Role info
        roleId: staff.roleId,
        roleName: staff.roleName,
        serviceCategory: staff.serviceCategory,
        
        // Metadata
        isActive: staff.isActive,
        canAcceptBookings: staff.canAcceptBookings !== false
      };
    })
  );

  // Sort results
  let sortedStaff = [...enrichedStaff];
  
  switch (sortBy) {
    case 'fee_low':
      sortedStaff.sort((a, b) => a.consultationFee - b.consultationFee);
      break;
    case 'fee_high':
      sortedStaff.sort((a, b) => b.consultationFee - a.consultationFee);
      break;
    case 'experience':
      sortedStaff.sort((a, b) => b.experience - a.experience);
      break;
    case 'rating':
      sortedStaff.sort((a, b) => b.rating - a.rating);
      break;
    case 'relevance':
    default:
      // Sort by: available today > rating > service count
      sortedStaff.sort((a, b) => {
        if (a.isAvailableToday !== b.isAvailableToday) {
          return b.isAvailableToday ? 1 : -1;
        }
        if (Math.abs(a.rating - b.rating) > 0.5) {
          return b.rating - a.rating;
        }
        return b.serviceCount - a.serviceCount;
      });
      break;
  }

  // Paginate
  const total = sortedStaff.length;
  const paginatedResults = sortedStaff.slice(offset, offset + limit);

  console.log(`✅ Returning ${paginatedResults.length} staff (${total} total)`);

  return c.json({
    success: true,
    results: paginatedResults,
    total,
    resultType: 'staff',
    pagination: {
      limit,
      offset,
      hasMore: offset + limit < total,
      totalPages: Math.ceil(total / limit),
      currentPage: Math.floor(offset / limit) + 1
    },
    filters: {
      serviceCategory,
      serviceStyle: serviceStyle || 'all',
      roleId: c.req.query('roleId') || 'all',
      searchQuery,
      feeRange: { min: feeMin, max: feeMax },
      availableToday,
      sortBy
    }
  });
}

/**
 * GET INDIVIDUAL STAFF/DOCTOR DETAILS
 * GET /make-server-3dd53475/customer/staff/:staffId
 */
app.get('/make-server-3dd53475/customer/staff/:staffId', async (c) => {
  try {
    const { staffId } = c.req.param();
    const db = getDbClient();
    const staffRepo = getStaffRepository();
    const vendorsRepo = getVendorsRepository();
    const reviewsRepo = getReviewsRepository();
    
    console.log(`\n👤 ===== GET STAFF DETAILS (SQL) =====`);
    console.log(`📝 Staff ID: ${staffId}`);
    
    // ✅ SQL: Get staff
    const staff = await staffRepo.findById(staffId);
    
    if (!staff) {
      return c.json({
        success: false,
        error: 'Staff not found'
      }, 404);
    }
    
    // ✅ SQL: Get vendor info
    const vendor = await vendorsRepo.findById(staff.vendorId);
    
    // ✅ SQL: Get all services (all styles)
    const allServices: any[] = [];
    
    for (const style of ['at_center', 'at_home', 'tele']) {
      // ✅ SQL: Get vendor services by style
      const { data: vendorServicesData } = await db
        .from('vendor_services')
        .select('*')
        .eq('vendor_id', staff.vendorId)
        .eq('service_style', style)
        .eq('publish_status', 'published')
        .eq('is_enabled', true);
      
      const vendorServices = vendorServicesData || [];
      
      // Filter services assigned to this staff
      const assignedServices = vendorServices.filter((s: any) =>
        staff.services?.some((ss: any) => ss.serviceId === s.service_id)
      ).map((s: any) => ({ ...s, serviceStyle: style }));
      
      allServices.push(...assignedServices);
    }
    
    // ✅ SQL: Get staff-specific services
    const { data: staffServicesData } = await db
      .from('staff_services')
      .select('*')
      .eq('staff_id', staff.id)
      .eq('is_active', true);
    
    allServices.push(...(staffServicesData || []));
    
    // ✅ SQL: Get availability for next 7 days
    const availability = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(Date.now() + i * 86400000).toISOString().split('T')[0];
      const { data: dayAvailData } = await db
        .from('staff_availability')
        .select('*')
        .eq('staff_id', staff.id)
        .eq('date', date)
        .limit(1);
      
      if (dayAvailData && dayAvailData.length > 0) {
        const dayAvail = dayAvailData[0];
        // Generate slots from time window
        const slots = generateSlotsFromTimeWindow(dayAvail.start_time, dayAvail.end_time, 30);
        availability.push({
          date,
          slots: slots,
          start_time: dayAvail.start_time,
          end_time: dayAvail.end_time
        });
      }
    }
    
    // ✅ SQL: Get reviews
    const { data: reviewsData } = await db
      .from('reviews')
      .select('*')
      .eq('staff_id', staff.id)
      .order('created_at', { ascending: false })
      .limit(10);
    
    const reviewsArray = reviewsData || [];
    const rating = reviewsArray.length > 0
      ? reviewsArray.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / reviewsArray.length
      : 0;
    
    const staffDetails = {
      id: staff.id,
      staffId: staff.id,
      name: staff.fullName,
      fullName: staff.fullName,
      photo: staff.photo || null,
      specialization: staff.specialization || '',
      degree: staff.degree || '',
      experience: staff.experience || 0,
      consultationFee: staff.consultationFee || 0,
      gender: staff.gender || '',
      languages: staff.languages || ['English', 'Hindi'],
      bio: staff.bio || '',
      
      // Ratings
      rating: parseFloat(rating.toFixed(1)),
      reviewCount: reviewsArray.length,
      reviews: reviewsArray.map((r: any) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        customerId: r.customer_id,
        createdAt: r.created_at
      })),
      
      // Vendor/Clinic
      vendorId: staff.vendorId,
      clinicId: staff.vendorId,
      clinicName: vendor?.business_name || vendor?.owner_name || '',
      clinicAddress: vendor?.address || '',
      clinicPhone: vendor?.phone || '',
      
      // Services
      services: allServices,
      serviceCount: allServices.length,
      
      // Availability
      availability,
      nextAvailable: availability[0]?.slots?.find((s: any) => s.status === 'available') || null,
      
      // Role info
      roleId: staff.roleId,
      roleName: staff.roleName,
      serviceCategory: staff.serviceCategory,
      
      // Metadata
      isActive: staff.isActive,
      canAcceptBookings: staff.canAcceptBookings !== false
    };
    
    console.log(`✅ Staff details retrieved successfully`);
    
    return c.json({
      success: true,
      staff: staffDetails
    });
    
  } catch (error) {
    console.error('❌ Error getting staff details:', error);
    return c.json({
      success: false,
      error: 'Failed to get staff details',
      message: String(error)
    }, 500);
  }
});

/**
 * GET CENTER/FACILITY DETAILS
 * GET /make-server-3dd53475/customer/center/:vendorId
 */
app.get('/make-server-3dd53475/customer/center/:vendorId', async (c) => {
  try {
    const { vendorId } = c.req.param();
    const db = getDbClient();
    const vendorsRepo = getVendorsRepository();
    const staffRepo = getStaffRepository();
    const reviewsRepo = getReviewsRepository();
    
    console.log(`\n🏢 ===== GET CENTER DETAILS (SQL) =====`);
    console.log(`📝 Vendor ID: ${vendorId}`);
    
    // ✅ SQL: Get vendor
    const vendor = await vendorsRepo.findById(vendorId);
    
    if (!vendor) {
      return c.json({
        success: false,
        error: 'Center not found'
      }, 404);
    }
    
    // ✅ SQL: Get all at_center services
    const { data: vendorServicesData } = await db
      .from('vendor_services')
      .select('*')
      .eq('vendor_id', vendor.id)
      .eq('service_style', 'at_center')
      .eq('publish_status', 'published')
      .eq('is_enabled', true);
    
    const publishedServices = vendorServicesData || [];
    
    // ✅ SQL: Get all staff
    const vendorStaff = await staffRepo.findByVendorId(vendor.id);
    const staff: any[] = [];
    
    for (const staffMember of vendorStaff) {
      if (staffMember.isActive) {
        // ✅ SQL: Get staff reviews
        const { data: reviewsData } = await db
          .from('reviews')
          .select('*')
          .eq('staff_id', staffMember.id)
          .order('created_at', { ascending: false });
        
        const reviewsArray = reviewsData || [];
        const staffRating = reviewsArray.length > 0
          ? reviewsArray.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / reviewsArray.length
          : 0;
        
        staff.push({
          id: staffMember.id,
          name: staffMember.fullName || staffMember.name,
          photo: staffMember.photo,
          specialization: staffMember.specialization,
          degree: staffMember.degree,
          experience: staffMember.experience,
          consultationFee: staffMember.consultationFee,
          rating: parseFloat(staffRating.toFixed(1)),
          reviewCount: reviewsArray.length
        });
      }
    }
    
    // Calculate center-level rating
    const avgRating = staff.length > 0
      ? staff.reduce((sum, s) => sum + s.rating, 0) / staff.length
      : 0;
    
    const totalReviews = staff.reduce((sum, s) => sum + s.reviewCount, 0);
    
    // ✅ SQL: Get all reviews
    const allReviews: any[] = [];
    for (const staffMember of staff) {
      const { data: reviewsData } = await db
        .from('reviews')
        .select('*')
        .eq('staff_id', staffMember.id)
        .order('created_at', { ascending: false });
      
      const reviewsArray = reviewsData || [];
      allReviews.push(...reviewsArray);
    }
    
    const centerDetails = {
      id: vendor.id,
      vendorId: vendor.id,
      type: 'center',
      name: vendor.business_name || vendor.owner_name,
      businessName: vendor.business_name || vendor.owner_name,
      fullName: vendor.owner_name,
      photo: vendor.business_logo || null,
      
      // Location
      address: vendor.address || '',
      city: vendor.city || '',
      state: vendor.state || '',
      pincode: vendor.pincode || '',
      phone: vendor.phone || '',
      email: vendor.email || '',
      
      // Services
      services: publishedServices.map((s: any) => ({
        serviceId: s.service_id,
        serviceName: s.service_name,
        price: s.price,
        duration: s.duration_minutes,
        category: s.category,
        subCategory: s.sub_category
      })),
      serviceCount: publishedServices.length,
      
      // Staff
      staff,
      staffCount: staff.length,
      
      // Ratings
      rating: parseFloat(avgRating.toFixed(1)),
      reviewCount: totalReviews,
      reviews: allReviews.slice(0, 10).map((r: any) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        customerId: r.customer_id,
        createdAt: r.created_at
      })),
      
      // Role info
      roleId: vendor.role_id,
      roleName: vendor.role_id,
      
      // Metadata
      isActive: vendor.is_active,
      status: vendor.status,
      establishedYear: vendor.experience_years || null,
      certifications: [],
      description: ''
    };
    
    console.log(`✅ Center details retrieved successfully`);
    
    return c.json({
      success: true,
      center: centerDetails
    });
    
  } catch (error) {
    console.error('❌ Error getting center details:', error);
    return c.json({
      success: false,
      error: 'Failed to get center details',
      message: String(error)
    }, 500);
  }
});


}
