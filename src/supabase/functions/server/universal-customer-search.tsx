/**
 * Universal Customer Search & Listing API
 * Works dynamically for ALL vendor roles and service categories
 * Supports filtering by service style (at_center, at_home, tele)
 * 
 * ARCHITECTURE DECISION:
 * - at_center services → Returns CENTERS/FACILITIES (customer selects venue)
 * - at_home/tele services → Returns STAFF (customer selects individual provider)
 */

import { Hono } from 'hono';
import * as kv from './kv_store';
import { getPrimarySpecialization, getAllSpecializations } from './specialization-mapping';
import { calculateDistance } from './schedule-utils';

/**
 * ✅ DYNAMIC ROLE MAPPING: Load role configurations from KV store
 * This ensures the system adapts automatically when new roles are added via Admin Panel
 */
async function getDynamicRoleMapping(): Promise<Record<string, string[]>> {
  try {
    // Get all role configurations from KV store
    const allRoles = await kv.getByPrefix('role:config:');
    
    // Build dynamic mapping
    const mapping: Record<string, string[]> = {};
    
    for (const role of allRoles) {
      if (role.serviceCategory && role.id) {
        if (!mapping[role.serviceCategory]) {
          mapping[role.serviceCategory] = [];
        }
        mapping[role.serviceCategory].push(role.id);
      }
    }
    
    console.log('📋 [DYNAMIC-ROLES] Loaded role mapping:', mapping);
    return mapping;
  } catch (error) {
    console.error('❌ [DYNAMIC-ROLES] Failed to load roles:', error);
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

    console.log(`\n🔍 ===== UNIVERSAL CUSTOMER SEARCH =====`);
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

    // ✅ DYNAMIC ROLE MAPPING: Load role configurations from KV store
    const dynamicRoleMapping = await getDynamicRoleMapping();
    const allowedRoleIds = dynamicRoleMapping[serviceCategory] || getStaticFallbackMapping(serviceCategory);
    console.log(`🔧 Mapped "${serviceCategory}" to roles:`, allowedRoleIds);

    // STEP 1: Get all approved vendors for this service category
    const allVendors = await kv.getByPrefix('vendor:vendor_');
    console.log(`📊 Total vendors in DB: ${allVendors.length}`);

    // ✅ CRITICAL FIX: Filter by roleId instead of serviceCategory
    let vendors = allVendors.filter((v: any) => 
      v.status === 'approved' &&
      v.isActive === true &&
      allowedRoleIds.includes(v.roleId) // ✅ FIXED: Match by roleId instead of serviceCategory
    );

    console.log(`📊 Approved vendors in category "${serviceCategory}": ${vendors.length}`);

    // Apply role filter if specified
    if (roleId) {
      vendors = vendors.filter((v: any) => v.roleId === roleId);
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

  for (const vendor of vendors) {
    // Get at_center services for this vendor
    const vendorServicesKey = `vendor_services:${vendor.id}:at_center`;
    const vendorServices = await kv.get(vendorServicesKey) || { services: [] };
    
    // Only include PUBLISHED services
    const publishedServices = vendorServices.services?.filter((s: any) =>
      s.isEnabled && s.publishStatus === 'published'
    ) || [];

    if (publishedServices.length === 0) {
      console.log(`⏭️  ${vendor.businessName || vendor.fullName}: No published at_center services`);
      continue;
    }

    // Get staff for this vendor
    const staffIds = await kv.get(`vendor:${vendor.id}:staff`) || [];
    const activeStaffCount = staffIds.length; // We'll count active ones below

    let activeStaff: any[] = [];
    for (const staffId of staffIds) {
      const staff = await kv.get(`staff:${staffId}`);
      if (staff && staff.isActive) {
        activeStaff.push(staff);
      }
    }

    // Calculate average fee from all active staff
    const avgFee = activeStaff.length > 0
      ? activeStaff.reduce((sum, s) => sum + (s.consultationFee || 0), 0) / activeStaff.length
      : (publishedServices[0]?.fee || 0);

    // Apply fee filter
    if (avgFee < feeMin || avgFee > feeMax) {
      console.log(`⏭️  ${vendor.businessName || vendor.fullName}: Fee ₹${avgFee} outside range`);
      continue;
    }

    // Get aggregated reviews/ratings from all staff
    let totalRating = 0;
    let totalReviews = 0;
    const allReviews: any[] = [];

    for (const staff of activeStaff) {
      const staffReviews = await kv.get(`doctor:${staff.id}:reviews`) || [];
      const reviewsArray = Array.isArray(staffReviews) ? staffReviews : [];
      allReviews.push(...reviewsArray);
      totalReviews += reviewsArray.length;
      
      if (reviewsArray.length > 0) {
        const staffRating = reviewsArray.reduce((sum: number, r: any) => 
          sum + (r.overall || r.rating || 0), 0) / reviewsArray.length;
        totalRating += staffRating;
      }
    }

    const centerRating = activeStaff.length > 0 && totalRating > 0
      ? totalRating / activeStaff.length
      : 0;

    // Check availability - find earliest slot from ANY staff
    let nextAvailable = null;
    let isAvailableToday = false;

    if (activeStaff.length > 0) {
      try {
        // Check next 7 days
        for (let i = 0; i < 7; i++) {
          const date = new Date(Date.now() + i * 86400000).toISOString().split('T')[0];
          
          // Check each staff member for availability
          for (const staff of activeStaff) {
            const availability = await kv.get(`doctor:${staff.id}:availability:${date}`) ||
                               await kv.get(`staff:${staff.id}:availability:${date}`);
            
            if (availability && availability.slots) {
              const firstAvailable = availability.slots.find((s: any) => s.status === 'available');
              if (firstAvailable) {
                nextAvailable = {
                  date,
                  time: firstAvailable.time,
                  isToday: i === 0,
                  isTomorrow: i === 1,
                  daysFromNow: i,
                  staffId: staff.id,
                  staffName: staff.fullName || staff.name
                };
                isAvailableToday = i === 0;
                break;
              }
            }
          }
          
          if (nextAvailable) break;
        }
      } catch (err) {
        console.warn(`⚠️ Could not fetch availability for ${vendor.id}`);
      }
    }

    // Apply availableToday filter
    if (availableToday && !isAvailableToday) {
      console.log(`⏭️  ${vendor.businessName || vendor.fullName}: Not available today`);
      continue;
    }

    // Apply search query filter
    if (searchQuery && searchQuery.length > 0) {
      const searchLower = searchQuery.toLowerCase();
      const nameMatch = vendor.businessName?.toLowerCase().includes(searchLower) ||
                       vendor.fullName?.toLowerCase().includes(searchLower);
      const addressMatch = vendor.address?.toLowerCase().includes(searchLower) ||
                          vendor.city?.toLowerCase().includes(searchLower);
      const servicesMatch = publishedServices.some((s: any) =>
        s.serviceName?.toLowerCase().includes(searchLower)
      );
      
      if (!nameMatch && !addressMatch && !servicesMatch) {
        continue;
      }
    }

    // ✅ Calculate distance if coordinates available
    let distance = null;
    const vendorLat = parseFloat(vendor.latitude || '0');
    const vendorLon = parseFloat(vendor.longitude || '0');
    if (customerLat && customerLon && vendorLat && vendorLon) {
      distance = calculateDistance(customerLat, customerLon, vendorLat, vendorLon);
      distance = parseFloat(distance.toFixed(1)); // Round to 1 decimal
    }

    // Build center object
    const centerObj = {
      id: vendor.id,
      vendorId: vendor.id,
      type: 'center',
      name: vendor.businessName || vendor.fullName,
      businessName: vendor.businessName || vendor.fullName,
      fullName: vendor.fullName,
      photo: vendor.businessLogo || vendor.photo || null,
      
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
      services: publishedServices,
      serviceCount: publishedServices.length,
      
      // Staff
      staffCount: activeStaff.length,
      staff: activeStaff.map(s => ({
        id: s.id,
        name: s.fullName || s.name,
        fullName: s.fullName || s.name, // ✅ Add fullName field
        photo: s.photo,
        specialization: getPrimarySpecialization(s), // ✅ FIXED: Use mapping function
        specializations: getAllSpecializations(s), // ✅ NEW: All specializations
        degree: s.degree,
        experience: s.experience || s.yearsOfExperience || 0, // ✅ Support both field names
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
      topReviews: allReviews.slice(0, 3),
      
      // Availability
      nextAvailable,
      isAvailableToday,
      hasAvailability: nextAvailable !== null,
      
      // Role info
      roleId: vendor.roleId,
      roleName: vendor.roleName,
      serviceCategory: vendor.serviceCategory,
      
      // Metadata
      isActive: vendor.isActive,
      status: vendor.status,
      establishedYear: vendor.establishedYear,
      certifications: vendor.certifications || []
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
  
  for (const vendor of vendors) {
    // Get vendor's staff list
    const staffIds = await kv.get(`vendor:${vendor.id}:staff`) || [];
    
    for (const staffId of staffIds) {
      const staff = await kv.get(`staff:${staffId}`);
      if (staff && staff.isActive) {
        // Attach vendor info to staff
        staff.vendorInfo = {
          id: vendor.id,
          businessName: vendor.businessName || vendor.fullName,
          fullName: vendor.fullName,
          address: vendor.address,
          city: vendor.city,
          state: vendor.state,
          pincode: vendor.pincode,
          phone: vendor.phone,
          latitude: vendor.latitude, // ✅ Add coordinates
          longitude: vendor.longitude,
          roleId: vendor.roleId,
          roleName: vendor.roleName
        };
        allStaff.push(staff);
      }
    }
  }

  console.log(`📊 Total active staff found: ${allStaff.length}`);

  // Filter by service style if specified
  if (serviceStyle) {
    console.log(`🎨 Filtering by service style: ${serviceStyle}`);
    
    const staffWithMatchingServices: any[] = [];
    
    for (const staff of allStaff) {
      // ✅ NEW ARCHITECTURE: Read staff.services array directly (already has full service objects)
      const staffServices = staff.services || [];
      
      // Filter by isActive and serviceStyle
      const matchingServices = staffServices.filter((s: any) =>
        s.isActive === true &&
        s.serviceStyle === serviceStyle
      );

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
      // ✅ NEW ARCHITECTURE: Read staff.services array directly (already has full service objects)
      const staffServices = staff.services || [];
      
      // Filter only active services (no style filter)
      const activeServices = staffServices.filter((s: any) => s.isActive === true);
      
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

  // Check availability if requested
  if (availableToday) {
    const today = new Date().toISOString().split('T')[0];
    
    const availableStaff: any[] = [];
    
    for (const staff of allStaff) {
      const availability = await kv.get(`doctor:${staff.id}:availability:${today}`) ||
                          await kv.get(`staff:${staff.id}:availability:${today}`);
      
      if (availability && availability.slots) {
        const hasAvailableSlot = availability.slots.some((slot: any) =>
          slot.status === 'available'
        );
        
        if (hasAvailableSlot) {
          availableStaff.push(staff);
        }
      }
    }
    
    allStaff = availableStaff;
    console.log(`📊 Available today: ${allStaff.length}`);
  }

  // Enrich with reviews and ratings
  const enrichedStaff = await Promise.all(
    allStaff.map(async (staff: any) => {
      // Get reviews
      const reviews = await kv.get(`doctor:${staff.id}:reviews`) || [];
      const reviewsArray = Array.isArray(reviews) ? reviews : [];
      const rating = reviewsArray.length > 0
        ? reviewsArray.reduce((sum: number, r: any) => sum + (r.overall || r.rating || 0), 0) / reviewsArray.length
        : 0;

      // Get next available slot
      let nextAvailable = null;
      try {
        // Check next 7 days for availability
        for (let i = 0; i < 7; i++) {
          const date = new Date(Date.now() + i * 86400000).toISOString().split('T')[0];
          const availability = await kv.get(`doctor:${staff.id}:availability:${date}`) ||
                              await kv.get(`staff:${staff.id}:availability:${date}`);
          
          if (availability && availability.slots) {
            const firstAvailable = availability.slots.find((s: any) => s.status === 'available');
            if (firstAvailable) {
              nextAvailable = {
                date,
                time: firstAvailable.time,
                isToday: i === 0,
                isTomorrow: i === 1,
                daysFromNow: i
              };
              break;
            }
          }
        }
      } catch (err) {
        console.warn(`⚠️ Could not fetch availability for ${staff.id}`);
      }

      // ✅ Calculate distance from vendor coordinates
      let distance = null;
      const vendorLat = parseFloat(staff.vendorInfo?.latitude || '0');
      const vendorLon = parseFloat(staff.vendorInfo?.longitude || '0');
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
        specialization: getPrimarySpecialization(staff), // ✅ FIXED: Use mapping function
        specializations: getAllSpecializations(staff), // ✅ NEW: All specializations
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
        distance: distance, // ✅ Distance in km
        
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
    
    console.log(`\n👤 ===== GET STAFF DETAILS =====`);
    console.log(`📝 Staff ID: ${staffId}`);
    
    const staff = await kv.get(`staff:${staffId}`);
    
    if (!staff) {
      return c.json({
        success: false,
        error: 'Staff not found'
      }, 404);
    }
    
    // Get vendor info
    const vendor = await kv.get(`vendor:${staff.vendorId}`);
    
    // Get all services (all styles)
    const allServices: any[] = [];
    
    for (const style of ['at_center', 'at_home', 'tele']) {
      const vendorServicesKey = `vendor_services:${staff.vendorId}:${style}`;
      const vendorServices = await kv.get(vendorServicesKey) || { services: [] };
      
      const assignedServices = vendorServices.services?.filter((s: any) =>
        staff.assignedServices?.includes(s.serviceId) &&
        s.isEnabled &&
        s.publishStatus === 'published'
      ).map((s: any) => ({ ...s, serviceStyle: style })) || [];
      
      allServices.push(...assignedServices);
    }
    
    // Get staff-specific services
    const staffServicesPrefix = `staff:${staff.id}:service:`;
    const staffServices = await kv.getByPrefix(staffServicesPrefix);
    const activeStaffServices = staffServices.filter((s: any) => s.isActive);
    
    allServices.push(...activeStaffServices);
    
    // Get availability for next 7 days
    const availability = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(Date.now() + i * 86400000).toISOString().split('T')[0];
      const dayAvail = await kv.get(`doctor:${staff.id}:availability:${date}`) ||
                       await kv.get(`staff:${staff.id}:availability:${date}`);
      
      if (dayAvail) {
        availability.push({
          date,
          ...dayAvail
        });
      }
    }
    
    // Get reviews
    const reviews = await kv.get(`doctor:${staff.id}:reviews`) || [];
    const reviewsArray = Array.isArray(reviews) ? reviews : [];
    const rating = reviewsArray.length > 0
      ? reviewsArray.reduce((sum: number, r: any) => sum + (r.overall || r.rating || 0), 0) / reviewsArray.length
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
      reviews: reviewsArray.slice(0, 10),
      
      // Vendor/Clinic
      vendorId: staff.vendorId,
      clinicId: staff.vendorId,
      clinicName: vendor?.businessName || vendor?.fullName || '',
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
    
    console.log(`\n🏢 ===== GET CENTER DETAILS =====`);
    console.log(`📝 Vendor ID: ${vendorId}`);
    
    const vendor = await kv.get(`vendor:${vendorId}`);
    
    if (!vendor) {
      return c.json({
        success: false,
        error: 'Center not found'
      }, 404);
    }
    
    // Get all at_center services
    const vendorServicesKey = `vendor_services:${vendor.id}:at_center`;
    const vendorServices = await kv.get(vendorServicesKey) || { services: [] };
    
    const publishedServices = vendorServices.services?.filter((s: any) =>
      s.isEnabled && s.publishStatus === 'published'
    ) || [];
    
    // Get all staff
    const staffIds = await kv.get(`vendor:${vendor.id}:staff`) || [];
    const staff: any[] = [];
    
    for (const staffId of staffIds) {
      const staffMember = await kv.get(`staff:${staffId}`);
      if (staffMember && staffMember.isActive) {
        // Get staff reviews
        const staffReviews = await kv.get(`doctor:${staffMember.id}:reviews`) || [];
        const reviewsArray = Array.isArray(staffReviews) ? staffReviews : [];
        const staffRating = reviewsArray.length > 0
          ? reviewsArray.reduce((sum: number, r: any) => sum + (r.overall || r.rating || 0), 0) / reviewsArray.length
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
    
    // Get all reviews
    const allReviews: any[] = [];
    for (const staffMember of staff) {
      const staffReviews = await kv.get(`doctor:${staffMember.id}:reviews`) || [];
      const reviewsArray = Array.isArray(staffReviews) ? staffReviews : [];
      allReviews.push(...reviewsArray);
    }
    
    const centerDetails = {
      id: vendor.id,
      vendorId: vendor.id,
      type: 'center',
      name: vendor.businessName || vendor.fullName,
      businessName: vendor.businessName || vendor.fullName,
      fullName: vendor.fullName,
      photo: vendor.businessLogo || vendor.photo || null,
      
      // Location
      address: vendor.address || '',
      city: vendor.city || '',
      state: vendor.state || '',
      pincode: vendor.pincode || '',
      phone: vendor.phone || '',
      email: vendor.email || '',
      
      // Services
      services: publishedServices,
      serviceCount: publishedServices.length,
      
      // Staff
      staff,
      staffCount: staff.length,
      
      // Ratings
      rating: parseFloat(avgRating.toFixed(1)),
      reviewCount: totalReviews,
      reviews: allReviews.slice(0, 10),
      
      // Role info
      roleId: vendor.roleId,
      roleName: vendor.roleName,
      serviceCategory: vendor.serviceCategory,
      
      // Metadata
      isActive: vendor.isActive,
      status: vendor.status,
      establishedYear: vendor.establishedYear,
      certifications: vendor.certifications || [],
      description: vendor.description || ''
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
