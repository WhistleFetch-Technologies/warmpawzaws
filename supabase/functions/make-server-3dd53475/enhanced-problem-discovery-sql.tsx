/**
 * ============================================================================
 * ENHANCED PROBLEM DISCOVERY SYSTEM - SQL VERSION
 * ============================================================================
 * 
 * Universal vendor discovery by problem across all vendor types
 * Replaces: platform:service_catalog, vendor:* prefix, vendor:{id}:staff, vendor_services:* KV keys
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { getVendorsRepository } from "../../lib/repositories/vendors.ts";
import { getStaffRepository } from "../../lib/repositories/staff.ts";
import { getDbClient } from "../../lib/db.ts";

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
    
    // ✅ SQL: Get matching services from catalog
    const { getSubcategoryNames, serviceMatchesSubcategories, subcategoryIdToNames } = 
      await import('./problem-subcategory-mapping.tsx');
    const targetSubcategoryNames = getSubcategoryNames(problem.mappedSubCategories);
    
    const db = getDbClient();
    const { data: serviceCatalogData, error: catalogError } = await db
      .from('service_catalog')
      .select('*')
      .eq('status', 'active')
      .eq('publish_status', 'published');
    
    if (catalogError) {
      console.error('Error fetching service catalog:', catalogError);
    }
    
    // Map service_catalog table data to expected format
    const serviceCatalog = (serviceCatalogData || []).map((s: any) => ({
      id: s.service_id || s.id,
      serviceId: s.service_id || s.id,
      serviceName: s.service_name,
      name: s.service_name,
      subCategoryName: s.sub_category_name,
      categoryName: s.category_name,
      applicableRoles: s.applicable_roles || [],
      serviceStyle: s.service_style,
      price: s.base_price,
      duration: s.duration_minutes
    }));
    
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
    const { buildApplicableRolesSet: legacyBuildRoles } = await import('./problem-grid-vendor-matcher-sql.tsx'); // ✅ SQL-only version
    const { buildApplicableRolesSet, filterVendorsByRole } = await import('./role-id-normalizer.tsx');
    
    // Build roles set from role-specific services only
    const applicableRoles = buildApplicableRolesSet(roleSpecificServices);
    console.log(`   Applicable Roles (expanded):`, Array.from(applicableRoles).slice(0, 10));
    
    // ✅ SQL: Get all vendors and filter by role with proper normalization
    const vendorsRepo = getVendorsRepository();
    const allVendorsData = await vendorsRepo.findAllActive();
    
    // Convert to expected format for filterVendorsByRole
    const allVendors = allVendorsData.map((v: any) => ({
      vendorId: v.id,
      businessName: v.business_name,
      roleId: v.role_id,
      isApproved: v.is_approved,
      isActive: v.is_active,
      location: v.location,
      address: v.address,
      logo: v.logo,
      description: v.description,
      rating: v.rating,
      reviewCount: v.review_count,
      phone: v.phone,
      consultationFee: v.consultation_fee
    }));
    
    const eligibleVendors = filterVendorsByRole(allVendors, applicableRoles, true, true);
    
    console.log(`   Total Vendors: ${allVendors.length}`);
    console.log(`   Eligible Vendors (approved, active, role match): ${eligibleVendors.length}`);
    
    // ✅ SQL: Pre-fetch vendor services
    const vendorServicesMap = await prefetchVendorServices(eligibleVendors, db);
    
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
      
      const staffRepo = getStaffRepository();
      
      for (const vendor of eligibleVendors) {
        // ✅ SQL: Get staff for this vendor
        const staffData = await staffRepo.findByVendorId(vendor.vendorId);
        
        const activeStaff = staffData.filter((staff: any) => 
          staff && staff.isActive !== false
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
            const vendorLocation = vendor.location as any;
            if (lat !== 0 && lng !== 0 && vendorLocation?.coordinates) {
              distance = calculateDistance(
                lat, lng,
                vendorLocation.coordinates.lat,
                vendorLocation.coordinates.lng
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
              centerAddress: vendorLocation?.address || vendor.address,
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
      
      const staffRepo = getStaffRepository();
      
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
        const vendorLocation = vendor.location as any;
        if (lat !== 0 && lng !== 0 && vendorLocation?.coordinates) {
          distance = calculateDistance(
            lat, lng,
            vendorLocation.coordinates.lat,
            vendorLocation.coordinates.lng
          );
          
          // Skip if outside radius
          if (distance > radius) continue;
        }
        
        // ✅ SQL: Get staff count for this center
        const staffData = await staffRepo.findByVendorId(vendor.vendorId);
        const staffCount = staffData.length;
        
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
          address: vendorLocation?.address || vendor.address,
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
 * ✅ SQL: Pre-fetch vendor services in batch
 */
async function prefetchVendorServices(vendors: any[], db: any): Promise<Map<string, any>> {
  const vendorServicesMap = new Map<string, any>();
  
  if (vendors.length === 0) return vendorServicesMap;
  
  const vendorIds = vendors.map((v: any) => v.vendorId);
  
  // ✅ SQL: Query service_publishing_centre_level table for vendor services
  const { data: publishedServices, error } = await db
    .from('service_publishing_centre_level')
    .select('*')
    .in('vendor_id', vendorIds)
    .eq('is_enabled', true)
    .in('publish_status', ['published', 'auto_published']);
  
  if (error) {
    console.error('Error fetching vendor services:', error);
  }
  
  // Group services by vendor_id and service_style
  const servicesByVendor: Record<string, any> = {};
  
  (publishedServices || []).forEach((ps: any) => {
    if (!servicesByVendor[ps.vendor_id]) {
      servicesByVendor[ps.vendor_id] = {
        at_home: { services: [] },
        at_center: { services: [] },
        tele: { services: [] },
        legacy: []
      };
    }
    
    const style = ps.service_style || 'at_center';
    if (servicesByVendor[ps.vendor_id][style]) {
      servicesByVendor[ps.vendor_id][style].services.push({
        serviceName: ps.service_name,
        name: ps.service_name,
        subCategoryName: ps.sub_category_name,
        categoryName: ps.category_name,
        isEnabled: ps.is_enabled,
        publishStatus: ps.publish_status
      });
    }
  });
  
  // Also check legacy vendor_services table if it exists
  const { data: legacyServices } = await db
    .from('vendor_services')
    .select('vendor_id, service_id')
    .in('vendor_id', vendorIds)
    .eq('is_enabled', true);
  
  (legacyServices || []).forEach((ls: any) => {
    if (!servicesByVendor[ls.vendor_id]) {
      servicesByVendor[ls.vendor_id] = {
        at_home: { services: [] },
        at_center: { services: [] },
        tele: { services: [] },
        legacy: []
      };
    }
    if (!servicesByVendor[ls.vendor_id].legacy.includes(ls.service_id)) {
      servicesByVendor[ls.vendor_id].legacy.push(ls.service_id);
    }
  });
  
  // Map to vendor IDs
  vendors.forEach((vendor: any) => {
    vendorServicesMap.set(vendor.vendorId, servicesByVendor[vendor.vendorId] || {
      at_home: null,
      at_center: null,
      tele: null,
      legacy: null
    });
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

