/**
 * ENHANCED PROBLEM DISCOVERY SYSTEM
 * Universal vendor discovery by problem across all vendor types
 */

import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";

const app = new Hono();

/**
 * Role-based entity type configuration
 * 
 * Business Rules:
 * - Veterinarians: Show BOTH individual doctors AND clinics (2 tabs)
 * - Groomers: Show BOTH individual groomers AND centers (2 tabs)
 * - Trainers: Show BOTH individual trainers AND centers (2 tabs)
 * - Walkers: Show ONLY individual walkers (NO centers, NO tabs)
 * - Behaviorists: Show BOTH individual staff AND centers (2 tabs)
 * - Boarding: Show ONLY centers (1 tab)
 */
const ROLE_ENTITY_CONFIG: Record<string, {
  showIndividualStaff: boolean;
  showCenters: boolean;
  staffLabel: string; // e.g., "Doctors", "Groomers", "Trainers"
  centerLabel: string; // e.g., "Clinics", "Centers"
  description: string;
}> = {
  // ✅ VETERINARY - Show BOTH doctors AND clinics (2 tabs)
  'veterinarian': { showIndividualStaff: true, showCenters: true, staffLabel: 'Doctors', centerLabel: 'Clinics', description: 'Doctors and Clinics' },
  'role_veterinarian': { showIndividualStaff: true, showCenters: true, staffLabel: 'Doctors', centerLabel: 'Clinics', description: 'Doctors and Clinics' },
  'vet_clinic': { showIndividualStaff: true, showCenters: true, staffLabel: 'Doctors', centerLabel: 'Clinics', description: 'Doctors and Clinics' },
  'role_vet_clinic': { showIndividualStaff: true, showCenters: true, staffLabel: 'Doctors', centerLabel: 'Clinics', description: 'Doctors and Clinics' },
  'pet_clinic': { showIndividualStaff: true, showCenters: true, staffLabel: 'Doctors', centerLabel: 'Clinics', description: 'Doctors and Clinics' },
  'role_pet_clinic': { showIndividualStaff: true, showCenters: true, staffLabel: 'Doctors', centerLabel: 'Clinics', description: 'Doctors and Clinics' },
  
  // ✅ GROOMING - Show BOTH groomers AND centers (2 tabs)
  'groomer': { showIndividualStaff: true, showCenters: true, staffLabel: 'Groomers', centerLabel: 'Centers', description: 'Groomers and Centers' },
  'role_groomer': { showIndividualStaff: true, showCenters: true, staffLabel: 'Groomers', centerLabel: 'Centers', description: 'Groomers and Centers' },
  'pet_groomer': { showIndividualStaff: true, showCenters: true, staffLabel: 'Groomers', centerLabel: 'Centers', description: 'Groomers and Centers' },
  'role_pet_groomer': { showIndividualStaff: true, showCenters: true, staffLabel: 'Groomers', centerLabel: 'Centers', description: 'Groomers and Centers' },
  
  // ✅ TRAINING - Show BOTH trainers AND centers (2 tabs)
  'trainer': { showIndividualStaff: true, showCenters: true, staffLabel: 'Trainers', centerLabel: 'Centers', description: 'Trainers and Centers' },
  'role_trainer': { showIndividualStaff: true, showCenters: true, staffLabel: 'Trainers', centerLabel: 'Centers', description: 'Trainers and Centers' },
  'pet_trainer': { showIndividualStaff: true, showCenters: true, staffLabel: 'Trainers', centerLabel: 'Centers', description: 'Trainers and Centers' },
  'role_pet_trainer': { showIndividualStaff: true, showCenters: true, staffLabel: 'Trainers', centerLabel: 'Centers', description: 'Trainers and Centers' },
  
  // ✅ WALKING - Show ONLY individual walkers (NO centers, NO tabs)
  'dog_walker': { showIndividualStaff: true, showCenters: false, staffLabel: 'Walkers', centerLabel: 'Centers', description: 'Walkers' },
  'role_dog_walker': { showIndividualStaff: true, showCenters: false, staffLabel: 'Walkers', centerLabel: 'Centers', description: 'Walkers' },
  'pet_walker': { showIndividualStaff: true, showCenters: false, staffLabel: 'Walkers', centerLabel: 'Centers', description: 'Walkers' },
  'role_pet_walker': { showIndividualStaff: true, showCenters: false, staffLabel: 'Walkers', centerLabel: 'Centers', description: 'Walkers' },
  
  // ✅ BEHAVIORAL - Show BOTH behaviorists AND centers (2 tabs)
  'behaviourist': { showIndividualStaff: true, showCenters: true, staffLabel: 'Behaviorists', centerLabel: 'Centers', description: 'Behaviorists and Centers' },
  'role_behaviourist': { showIndividualStaff: true, showCenters: true, staffLabel: 'Behaviorists', centerLabel: 'Centers', description: 'Behaviorists and Centers' },
  'behaviorist': { showIndividualStaff: true, showCenters: true, staffLabel: 'Behaviorists', centerLabel: 'Centers', description: 'Behaviorists and Centers' },
  'role_behaviorist': { showIndividualStaff: true, showCenters: true, staffLabel: 'Behaviorists', centerLabel: 'Centers', description: 'Behaviorists and Centers' },
  
  // ✅ BOARDING - Show ONLY centers (1 tab)
  'boarding': { showIndividualStaff: false, showCenters: true, staffLabel: 'Staff', centerLabel: 'Centers', description: 'Boarding Centers' },
  'role_boarding': { showIndividualStaff: false, showCenters: true, staffLabel: 'Staff', centerLabel: 'Centers', description: 'Boarding Centers' },
  'pet_boarding': { showIndividualStaff: false, showCenters: true, staffLabel: 'Staff', centerLabel: 'Centers', description: 'Boarding Centers' },
  'role_pet_boarding': { showIndividualStaff: false, showCenters: true, staffLabel: 'Staff', centerLabel: 'Centers', description: 'Boarding Centers' },
};

/**
 * 🔍 ENHANCED VENDOR DISCOVERY BY PROBLEM
 * GET /customer/discover-by-problem-v2/:roleId/:problemId
 */
app.get('/make-server-3dd53475/customer/discover-by-problem-v2/:roleId/:problemId', async (c) => {
  try {
    const roleId = c.req.param('roleId');
    const problemId = c.req.param('problemId');
    const lat = parseFloat(c.req.query('lat') || '0');
    const lng = parseFloat(c.req.query('lng') || '0');
    const radius = parseInt(c.req.query('radius') || '50');
    
    console.log(`\n🔍 [ENHANCED DISCOVERY] Starting discovery...`);
    console.log(`   Role: ${roleId}`);
    console.log(`   Problem: ${problemId}`);
    console.log(`   Location: ${lat},${lng} (radius: ${radius}km)`);
    
    // ✅ Validation
    if (!problemId || problemId === 'undefined' || problemId === 'null') {
      return c.json({ error: 'Invalid problem ID' }, 400);
    }
    
    if (!roleId || roleId === 'undefined' || roleId === 'null') {
      return c.json({ error: 'Invalid role ID' }, 400);
    }
    
    // ✅ Get role configuration
    const roleConfig = ROLE_ENTITY_CONFIG[roleId];
    if (!roleConfig) {
      console.warn(`⚠️ No entity config for role: ${roleId}, using defaults (centers only)`);
    }
    
    const showIndividualStaff = roleConfig?.showIndividualStaff ?? false;
    const showCenters = roleConfig?.showCenters ?? true;
    
    console.log(`   Entity Config: Staff=${showIndividualStaff}, Centers=${showCenters}`);
    
    // ✅ Get problem details
    const { findProblemById } = await import('./problem-grid-catalog.tsx');
    const problem = findProblemById(problemId);
    
    if (!problem) {
      return c.json({ error: 'Problem not found' }, 404);
    }
    
    console.log(`   Problem: "${problem.name}"`);
    console.log(`   Mapped Subcategories:`, problem.mappedSubCategories);
    
    if (!problem.mappedSubCategories || problem.mappedSubCategories.length === 0) {
      return c.json({ error: 'Problem has no mapped subcategories' }, 400);
    }
    
    // ✅ Get matching services from catalog
    const { getSubcategoryNames, serviceMatchesSubcategories, subcategoryIdToNames } = 
      await import('./problem-subcategory-mapping.tsx');
    const targetSubcategoryNames = getSubcategoryNames(problem.mappedSubCategories);
    
    const serviceCatalog = await kv.get('platform:service_catalog') || [];
    const matchingServices = serviceCatalog.filter((service: any) => 
      serviceMatchesSubcategories(service, problem.mappedSubCategories, false)
    );
    
    console.log(`   Matching Services: ${matchingServices.length}`);
    
    // ✅ CRITICAL FIX: Filter matching services to ONLY include the requested roleId
    // This prevents grooming services from appearing in vet results
    const normalizedRequestedRole = roleId.replace(/^role_/, '');
    
    // 🔍 DEBUG: Log the first few matching services to see their roles
    if (matchingServices.length > 0) {
      console.log(`   📋 Sample matching services (first 3):`);
      matchingServices.slice(0, 3).forEach((s: any) => {
        console.log(`      - "${s.serviceName}": roles=${JSON.stringify(s.applicableRoles)}`);
      });
    }
    
    const roleSpecificServices = matchingServices.filter((service: any) => {
      const applicableRoles = service.applicableRoles || [];
      const hasMatch = applicableRoles.some((role: string) => {
        const normalizedRole = role.replace(/^role_/, '');
        // Check multiple variations for better matching
        return normalizedRole === normalizedRequestedRole ||
               normalizedRole === `pet_${normalizedRequestedRole}` ||
               `pet_${normalizedRole}` === normalizedRequestedRole ||
               normalizedRole.replace('pet_', '') === normalizedRequestedRole ||
               normalizedRole === roleId; // Also check exact match
      });
      return hasMatch;
    });
    
    console.log(`   Role-Specific Services (${normalizedRequestedRole}): ${roleSpecificServices.length}`);
    
    // ✅ Build applicable roles set with proper normalization - using ONLY the requested role
    const { buildApplicableRolesSet: legacyBuildRoles } = await import('./problem-grid-vendor-matcher.tsx');
    const { buildApplicableRolesSet, filterVendorsByRole } = await import('./role-id-normalizer.tsx');
    
    // Build roles set from role-specific services only
    const applicableRoles = buildApplicableRolesSet(roleSpecificServices);
    console.log(`   Applicable Roles (expanded):`, Array.from(applicableRoles).slice(0, 10));
    
    // ✅ Get all vendors and filter by role with proper normalization
    const allVendors = await kv.getByPrefix('vendor:') || [];
    const eligibleVendors = filterVendorsByRole(allVendors, applicableRoles, true, true);
    
    console.log(`   Total Vendors: ${allVendors.length}`);
    console.log(`   Eligible Vendors (approved, active, role match): ${eligibleVendors.length}`);
    
    // ✅ Pre-fetch vendor services
    const vendorServicesMap = await prefetchVendorServices(eligibleVendors);
    
    // ✅ Prepare matching criteria
    const matchingServiceNames = new Set(matchingServices.map((s: any) => s.serviceName));
    const allSubcategoryVariations = new Set<string>();
    problem.mappedSubCategories.forEach((id: string) => {
      const variations = subcategoryIdToNames[id] || [];
      variations.forEach((v: string) => allSubcategoryVariations.add(v));
    });
    matchingServices.forEach((s: any) => {
      if (s.subCategoryName) allSubcategoryVariations.add(s.subCategoryName);
    });
    
    const results: any[] = [];
    
    // ✅ STEP 1: Collect individual staff (if role allows)
    if (showIndividualStaff) {
      console.log(`\n👤 [STAFF DISCOVERY] Searching for individual staff...`);
      
      for (const vendor of eligibleVendors) {
        // Get staff for this vendor
        const staffIds = await kv.get(`vendor:${vendor.vendorId}:staff`) || [];
        const staffKeys = staffIds.map((id: string) => `staff:${id}`);
        const staffData = staffKeys.length > 0 ? await kv.mget(staffKeys) : [];
        
        const activeStaff = staffData.filter((staff: any) => 
          staff && staff.isActive !== false && staff.status === 'active'
        );
        
        for (const staff of activeStaff) {
          // Check if staff has matching specialization
          const hasMatchingSpecialization = checkStaffSpecialization(
            staff, 
            problem.mappedSubCategories,
            allSubcategoryVariations
          );
          
          if (hasMatchingSpecialization) {
            // Calculate distance
            let distance = null;
            if (lat !== 0 && lng !== 0 && vendor.location?.coordinates) {
              distance = calculateDistance(
                lat, lng,
                vendor.location.coordinates.lat,
                vendor.location.coordinates.lng
              );
              
              // Skip if outside radius
              if (distance > radius) continue;
            }
            
            console.log(`   ✅ STAFF MATCH: ${staff.fullName} at ${vendor.businessName}`);
            
            results.push({
              entityType: 'staff',
              entityId: staff.id,
              vendorId: vendor.vendorId,
              
              // Staff details
              name: staff.fullName,
              photo: staff.profilePhoto,
              specialization: staff.specialization,
              specializations: staff.specializations || [],
              
              // Parent vendor details
              centerName: vendor.businessName,
              centerAddress: vendor.location?.address || vendor.address,
              centerLocation: vendor.location,
              
              // Service details
              serviceStyles: staff.serviceStyles || ['at_center'],
              consultationFee: staff.consultationFee || vendor.consultationFee || 500,
              
              // Ratings
              rating: staff.rating || vendor.rating || 4.5,
              reviewCount: staff.reviewCount || 0,
              
              // Professional info
              experience: staff.experience,
              qualifications: staff.qualifications,
              availability: staff.availability,
              
              // Location
              distance,
              
              // Match info
              matchReason: 'specialization'
            });
          }
        }
      }
      
      console.log(`   Found ${results.length} matching staff members`);
    }
    
    // ✅ STEP 2: Collect centers/vendors (if role allows)
    if (showCenters) {
      console.log(`\n🏢 [CENTER DISCOVERY] Searching for centers...`);
      
      for (const vendor of eligibleVendors) {
        // Check if vendor has matching services published
        const hasMatchingServices = checkVendorServices(
          vendor,
          vendorServicesMap.get(vendor.vendorId),
          matchingServiceNames,
          allSubcategoryVariations,
          matchingServices
        );
        
        if (!hasMatchingServices) continue;
        
        // Calculate distance
        let distance = null;
        if (lat !== 0 && lng !== 0 && vendor.location?.coordinates) {
          distance = calculateDistance(
            lat, lng,
            vendor.location.coordinates.lat,
            vendor.location.coordinates.lng
          );
          
          // Skip if outside radius
          if (distance > radius) continue;
        }
        
        // Get staff count for this center
        const staffIds = await kv.get(`vendor:${vendor.vendorId}:staff`) || [];
        const staffCount = staffIds.length;
        
        // Get available service styles
        const vendorServices = matchingServices.filter((service: any) => 
          (service.applicableRoles || []).some((role: string) => 
            role === vendor.roleId || role === `role_${vendor.roleId}`
          )
        );
        const serviceStyles = new Set<string>();
        vendorServices.forEach((service: any) => {
          if (service.serviceStyle) serviceStyles.add(service.serviceStyle);
        });
        
        console.log(`   ✅ CENTER MATCH: ${vendor.businessName}`);
        
        results.push({
          entityType: 'center',
          entityId: vendor.vendorId,
          vendorId: vendor.vendorId,
          
          // Center details
          name: vendor.businessName,
          photo: vendor.logo,
          description: vendor.description,
          
          // Location
          address: vendor.location?.address || vendor.address,
          location: vendor.location,
          distance,
          
          // Service details
          serviceStyles: Array.from(serviceStyles),
          
          // Staff info
          staffCount,
          
          // Ratings
          rating: vendor.rating || 4.5,
          reviewCount: vendor.reviewCount || 0,
          
          // Contact
          phone: vendor.phone,
          
          // Match info
          matchReason: 'services',
          matchingServices: vendorServices.length
        });
      }
      
      console.log(`   Found ${results.filter(r => r.entityType === 'center').length} matching centers`);
    }
    
    // ✅ Sort results
    if (lat !== 0 && lng !== 0) {
      // Sort by distance
      results.sort((a, b) => (a.distance || 999) - (b.distance || 999));
    } else {
      // Sort by rating
      results.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }
    
    console.log(`\n✅ [ENHANCED DISCOVERY] Returning ${results.length} results`);
    console.log(`   Staff: ${results.filter(r => r.entityType === 'staff').length}`);
    console.log(`   Centers: ${results.filter(r => r.entityType === 'center').length}`);
    
    return c.json({
      success: true,
      problem,
      roleConfig: {
        showIndividualStaff,
        showCenters,
        staffLabel: roleConfig?.staffLabel || 'Staff',
        centerLabel: roleConfig?.centerLabel || 'Centers',
        description: roleConfig?.description || 'Service Providers'
      },
      results,
      count: results.length,
      breakdown: {
        staff: results.filter(r => r.entityType === 'staff').length,
        centers: results.filter(r => r.entityType === 'center').length
      },
      // ✅ ADD: Missing fields for test results display
      matchedSubcategories: problem.mappedSubCategories || [],
      totalMatchingServices: roleSpecificServices.length,
      sampleServices: roleSpecificServices.slice(0, 10).map((s: any) => ({
        serviceName: s.serviceName,
        subCategoryName: s.subCategoryName,
        price: s.price,
        duration: s.duration
      })),
      filters: { lat, lng, radius }
    });
    
  } catch (error) {
    console.error('❌ [ENHANCED DISCOVERY] Error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * Pre-fetch vendor services in batch
 */
async function prefetchVendorServices(vendors: any[]): Promise<Map<string, any>> {
  const vendorServicesMap = new Map<string, any>();
  
  const allKeys: string[] = [];
  vendors.forEach((vendor: any) => {
    ['at_home', 'at_center', 'tele'].forEach(style => {
      allKeys.push(`vendor_services:${vendor.vendorId}:${style}`);
    });
    allKeys.push(`vendor:${vendor.vendorId}:services`);
  });
  
  const allData = await kv.mget(allKeys);
  
  vendors.forEach((vendor: any) => {
    const vendorServices: any = {
      at_home: null,
      at_center: null,
      tele: null,
      legacy: null
    };
    
    ['at_home', 'at_center', 'tele'].forEach((style) => {
      const key = `vendor_services:${vendor.vendorId}:${style}`;
      const keyIndex = allKeys.indexOf(key);
      if (keyIndex >= 0) {
        vendorServices[style] = allData[keyIndex];
      }
    });
    
    const legacyKey = `vendor:${vendor.vendorId}:services`;
    const legacyIndex = allKeys.indexOf(legacyKey);
    if (legacyIndex >= 0) {
      vendorServices.legacy = allData[legacyIndex];
    }
    
    vendorServicesMap.set(vendor.vendorId, vendorServices);
  });
  
  return vendorServicesMap;
}

/**
 * Check if staff has matching specialization
 */
function checkStaffSpecialization(
  staff: any,
  mappedSubCategories: string[],
  allVariations: Set<string>
): boolean {
  // Check new specializations array
  if (staff.specializations && Array.isArray(staff.specializations)) {
    const hasMatch = staff.specializations.some((spec: string) => 
      mappedSubCategories.includes(spec) || allVariations.has(spec)
    );
    if (hasMatch) return true;
  }
  
  // Check old specialization field
  if (staff.specialization) {
    const normalized = staff.specialization.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    if (mappedSubCategories.some(cat => normalized.includes(cat))) {
      return true;
    }
    if (allVariations.has(staff.specialization)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Check if vendor has matching services
 */
function checkVendorServices(
  vendor: any,
  vendorServices: any,
  matchingServiceNames: Set<string>,
  allSubcategoryVariations: Set<string>,
  matchingServices: any[]
): boolean {
  if (!vendorServices) return false;
  
  // Check new format
  for (const style of ['at_home', 'at_center', 'tele']) {
    const vsData = vendorServices[style];
    if (vsData && vsData.services) {
      const published = vsData.services.filter((s: any) => 
        s.isEnabled && (s.publishStatus === 'published' || s.publishStatus === 'auto_published')
      );
      
      for (const ps of published) {
        const nameMatch = matchingServiceNames.has(ps.serviceName || ps.name);
        const subcategoryMatch = allSubcategoryVariations.has(ps.subCategoryName || ps.categoryName);
        
        if (nameMatch || subcategoryMatch) {
          return true;
        }
      }
    }
  }
  
  // Check legacy format
  const enabledIds = vendorServices.legacy || [];
  if (enabledIds.length > 0) {
    const catalogIds = new Set(matchingServices.map((s: any) => s.id || s.serviceId));
    if (enabledIds.some((id: string) => catalogIds.has(id))) {
      return true;
    }
  }
  
  return false;
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of Earth in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default app;