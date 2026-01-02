/**
 * ============================================================================
 * UNIVERSAL STAFF PROBLEM SEARCH - SQL-ONLY VERSION
 * ============================================================================
 * 
 * ✅ SQL-ONLY: Removed all KV usage, using SQL repositories only
 * 
 * CORRECT APPROACH:
 * 1. First search ALL staff with minimum 1 active and published service
 * 2. Then check if their specialization matches the problem grid
 * 3. Show doctors list and associated clinic dynamically for all roles/vendors
 * 
 * CHANGES:
 * - Removed `kv` imports
 * - Replaced all `kv.get()`, `kv.getByPrefix()` with SQL queries
 * - Uses `StaffRepository`, `VendorsRepository`, `ServicesRepository`
 * - Uses `staff`, `vendors`, `staff_services`, `vendor_services`, `staff_specializations` tables
 * 
 * Date: 2025-01-28
 * Migration: Batch 10 Phase 1 - KV to SQL (7 KV operations removed)
 * ============================================================================
 */

import { Hono } from 'npm:hono';
import { getStaffRepository } from '../../lib/repositories/staff.ts';
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { getDbClient } from '../../lib/db.ts';
import { calculateDistance } from './schedule-utils-sql.tsx'; // ✅ FIXED: Updated to SQL version
import { getPrimarySpecialization, getAllSpecializations } from './specialization-mapping.tsx';

const app = new Hono();
const db = getDbClient();
const staffRepo = getStaffRepository();
const vendorsRepo = getVendorsRepository();

/**
 * GET /make-server-3dd53475/customer/staff-by-problem/:roleId/:problemId
 * 
 * Search for staff members by problem category
 * - Works for ALL vendor types (vet, groomer, trainer, walker, behaviorist, boarding)
 * - Returns staff with at least 1 active published service
 * - Filters by specialization matching problem grid
 * - Includes parent clinic/vendor information
 */
app.get('/make-server-3dd53475/customer/staff-by-problem/:roleId/:problemId', async (c) => {
  try {
    const roleId = c.req.param('roleId');
    const problemId = c.req.param('problemId');
    const lat = parseFloat(c.req.query('lat') || '0');
    const lng = parseFloat(c.req.query('lng') || '0');
    const radius = parseInt(c.req.query('radius') || '50');
    const limit = parseInt(c.req.query('limit') || '20');
    const offset = parseInt(c.req.query('offset') || '0');
    
    console.log(`\n🔍 [STAFF-BY-PROBLEM] Starting search...`);
    console.log(`   Role: ${roleId}`);
    console.log(`   Problem: ${problemId}`);
    console.log(`   Location: ${lat},${lng} (radius: ${radius}km)`);
    
    // ✅ STEP 1: Get problem details and mapped subcategories
    const { findProblemById } = await import('./problem-grid-catalog.tsx');
    const problem = findProblemById(problemId);
    
    if (!problem) {
      return c.json({ 
        success: false, 
        error: 'Problem not found',
        problemId 
      }, 404);
    }
    
    console.log(`   Problem: "${problem.name}"`);
    console.log(`   Mapped Subcategories:`, problem.mappedSubCategories);
    
    if (!problem.mappedSubCategories || problem.mappedSubCategories.length === 0) {
      return c.json({ 
        success: false, 
        error: 'Problem has no mapped subcategories',
        problem 
      }, 400);
    }
    
    // ✅ STEP 2: Get all approved and active vendors for this role (SQL)
    const normalizedRoleId = roleId.replace(/^role_/, '');
    
    const { data: eligibleVendors, error: vendorsError } = await db
      .from('vendors')
      .select('*')
      .eq('role_id', normalizedRoleId)
      .eq('status', 'approved')
      .eq('is_active', true);
    
    if (vendorsError) {
      console.error('❌ Error fetching vendors:', vendorsError);
      return c.json({ error: 'Failed to fetch vendors' }, 500);
    }
    
    console.log(`   Total vendors: ${eligibleVendors?.length || 0}`);
    console.log(`   Eligible vendors (approved, active, role match): ${eligibleVendors?.length || 0}`);
    
    if (!eligibleVendors || eligibleVendors.length === 0) {
      return c.json({
        success: true,
        staff: [],
        clinics: [],
        total: 0,
        message: 'No eligible vendors found for this role'
      });
    }
    
    // ✅ STEP 3: Build subcategory matching sets for specialization check
    const { subcategoryIdToNames } = await import('./problem-subcategory-mapping.tsx');
    const allSubcategoryVariations = new Set<string>();
    
    // Add all name variations for each mapped subcategory
    problem.mappedSubCategories.forEach((subCatId: string) => {
      allSubcategoryVariations.add(subCatId);
      const names = subcategoryIdToNames[subCatId] || [];
      names.forEach((name: string) => allSubcategoryVariations.add(name));
    });
    
    console.log(`   Subcategory variations to match:`, Array.from(allSubcategoryVariations).slice(0, 10));
    
    // ✅ STEP 4: Search through all staff across eligible vendors (SQL)
    const staffResults: any[] = [];
    const clinicMap = new Map<string, any>();
    
    for (const vendor of eligibleVendors) {
      // ✅ SQL: Get staff for this vendor
      const { data: staffMembers, error: staffError } = await db
        .from('staff')
        .select(`
          *,
          staff_specializations (*)
        `)
        .eq('vendor_id', vendor.id)
        .eq('is_active', true);
      
      if (staffError) {
        console.error(`❌ Error fetching staff for vendor ${vendor.id}:`, staffError);
        continue;
      }
      
      console.log(`\n   🏢 Vendor: ${vendor.business_name || vendor.owner_name} (${vendor.id})`);
      console.log(`      Staff count: ${staffMembers?.length || 0}`);
      
      if (!staffMembers || staffMembers.length === 0) continue;
      
      for (const staff of staffMembers) {
        console.log(`      👤 ${staff.full_name}:`);
        
        // ✅ SQL: Get active published services for this staff
        const { data: staffServices, error: servicesError } = await db
          .from('staff_services')
          .select(`
            *,
            services (*)
          `)
          .eq('staff_id', staff.id)
          .eq('is_active', true);
        
        if (servicesError) {
          console.error(`❌ Error fetching services for staff ${staff.id}:`, servicesError);
          continue;
        }
        
        // Check if services are published at vendor level
        const serviceIds = (staffServices || []).map((s: any) => s.service_id).filter(Boolean);
        let publishedServices: any[] = [];
        
        if (serviceIds.length > 0) {
          const { data: vendorServices } = await db
            .from('vendor_services')
            .select('*')
            .eq('vendor_id', vendor.id)
            .in('service_id', serviceIds)
            .eq('publish_status', 'published')
            .eq('is_enabled', true);
          
          const publishedServiceIds = new Set((vendorServices || []).map((vs: any) => vs.service_id));
          publishedServices = (staffServices || []).filter((s: any) => 
            publishedServiceIds.has(s.service_id)
          );
        }
        
        console.log(`         Services: ${staffServices?.length || 0} total, ${publishedServices.length} active`);
        
        if (publishedServices.length === 0) {
          console.log(`         ❌ SKIPPED - No active published services`);
          continue;
        }
        
        // ✅ STEP 5: Check specialization match
        const staffSpecializations = staff.staff_specializations?.map((s: any) => s.specialization_id) || [];
        const specializationMatch = checkStaffSpecialization(
          staff,
          staffSpecializations,
          problem.mappedSubCategories,
          allSubcategoryVariations
        );
        
        console.log(`         Specialization: ${staff.specialization || 'None'}`);
        console.log(`         Specializations array: ${staffSpecializations.join(', ') || 'None'}`);
        console.log(`         Match: ${specializationMatch ? '✅ YES' : '❌ NO'}`);
        
        if (!specializationMatch) {
          continue;
        }
        
        // ✅ Calculate distance if location provided
        let distance = null;
        if (lat !== 0 && lng !== 0 && vendor.latitude && vendor.longitude) {
          const vendorLat = parseFloat(vendor.latitude);
          const vendorLon = parseFloat(vendor.longitude);
          
          if (vendorLat && vendorLon) {
            distance = calculateDistance(lat, lng, vendorLat, vendorLon);
            
            // Skip if outside radius
            if (distance > radius) {
              console.log(`         ❌ SKIPPED - Outside radius (${distance.toFixed(1)}km > ${radius}km)`);
              continue;
            }
          }
        }
        
        console.log(`         ✅ INCLUDED - Has services and matching specialization`);
        
        // Build staff result
        const staffResult = {
          entityType: 'staff',
          id: staff.id,
          staffId: staff.id,
          fullName: staff.full_name,
          name: staff.full_name,
          photo: staff.photo || staff.profile_photo,
          
          // Specialization
          specialization: getPrimarySpecialization(staff),
          specializations: getAllSpecializations(staff),
          
          // Professional info
          qualification: staff.qualification,
          degree: staff.degree || staff.qualification,
          yearsOfExperience: staff.experience_years || staff.experience || 0,
          experience: staff.experience_years || staff.experience || 0,
          bio: staff.bio || staff.about || '',
          languages: staff.languages || ['English', 'Hindi'],
          
          // Consultation fee
          consultationFee: staff.consultation_fee || vendor.consultation_fee || 500,
          
          // Ratings
          rating: staff.rating || vendor.rating || 4.5,
          totalReviews: staff.total_reviews || 0,
          reviewCount: staff.total_reviews || 0,
          
          // Gender
          gender: staff.gender || '',
          
          // Services
          services: publishedServices.map((s: any) => ({
            id: s.id || s.service_id,
            serviceId: s.service_id || s.id,
            name: s.services?.name || s.service_name || 'Service',
            category: s.services?.category || s.category || '',
            categoryName: s.services?.category || s.category || '',
            price: parseFloat(s.price || s.services?.price || 0),
            duration: s.duration || s.services?.duration_minutes || 30,
            serviceStyle: s.service_style || 'at_center',
            description: s.description || s.services?.description || ''
          })),
          serviceCount: publishedServices.length,
          
          // Parent clinic/vendor info
          clinicId: vendor.id,
          vendorId: vendor.id,
          clinicName: vendor.business_name || vendor.owner_name,
          centerName: vendor.business_name || vendor.owner_name,
          clinicAddress: vendor.address,
          centerAddress: vendor.address,
          clinicCity: vendor.city,
          clinicState: vendor.state,
          clinicPincode: vendor.pincode,
          clinicPhone: vendor.phone,
          location: vendor.address,
          
          // Distance
          distance,
          
          // Availability
          availableToday: true,
          availability: staff.availability || [],
          nextAvailableSlot: 'Today 2:00 PM',
          
          // Match info
          matchReason: 'specialization',
          problemMatched: problem.name
        };
        
        staffResults.push(staffResult);
        
        // Add clinic to clinic map
        if (!clinicMap.has(vendor.id)) {
          clinicMap.set(vendor.id, {
            entityType: 'clinic',
            id: vendor.id,
            vendorId: vendor.id,
            name: vendor.business_name || vendor.owner_name,
            businessName: vendor.business_name || vendor.owner_name,
            address: vendor.address,
            city: vendor.city,
            state: vendor.state,
            pincode: vendor.pincode,
            phone: vendor.phone,
            email: vendor.email,
            photo: vendor.photos?.[0] || vendor.logo || '',
            
            rating: vendor.rating || 4.5,
            reviewCount: vendor.total_reviews || 0,
            totalReviews: vendor.total_reviews || 0,
            
            roleId: vendor.role_id,
            roleName: vendor.role_name,
            
            isPremium: vendor.is_premium || false,
            isVerified: vendor.is_verified !== false,
            
            distance,
            
            staffCount: 0,
            matchingStaffCount: 0,
            serviceCount: 0,
            doctors: []
          });
        }
      }
    }
    
    console.log(`\n📊 Found ${staffResults.length} matching staff members`);
    
    // ✅ STEP 6: Enrich clinics with staff counts and service counts (SQL)
    const clinics = Array.from(clinicMap.values());
    
    for (const clinic of clinics) {
      // ✅ SQL: Count all staff
      const { count: staffCount } = await db
        .from('staff')
        .select('*', { count: 'exact', head: true })
        .eq('vendor_id', clinic.id)
        .eq('is_active', true);
      
      clinic.staffCount = staffCount || 0;
      
      // Count matching staff
      const matchingStaff = staffResults.filter(s => s.clinicId === clinic.id);
      clinic.matchingStaffCount = matchingStaff.length;
      
      // Add top 3 matching staff as doctors preview
      clinic.doctors = matchingStaff.slice(0, 3).map((s: any) => ({
        id: s.id,
        name: s.fullName,
        specialization: s.specialization,
        photo: s.photo
      }));
      
      // ✅ SQL: Count published services
      const { data: allServices } = await db
        .from('vendor_services')
        .select('*')
        .eq('vendor_id', clinic.id)
        .eq('is_enabled', true)
        .in('publish_status', ['published', 'auto_published']);
      
      clinic.serviceCount = allServices?.length || 0;
    }
    
    console.log(`📊 Found ${clinics.length} associated clinics`);
    
    // ✅ STEP 7: Sort results
    if (lat !== 0 && lng !== 0) {
      staffResults.sort((a, b) => (a.distance || 999) - (b.distance || 999));
      clinics.sort((a, b) => (a.distance || 999) - (b.distance || 999));
    } else {
      staffResults.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      clinics.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }
    
    // ✅ STEP 8: Paginate staff results
    const total = staffResults.length;
    const paginatedStaff = staffResults.slice(offset, offset + limit);
    
    console.log(`✅ Returning ${paginatedStaff.length} staff members (page ${Math.floor(offset / limit) + 1})`);
    console.log(`✅ Returning ${clinics.length} associated clinics`);
    
    return c.json({
      success: true,
      problem,
      roleId,
      staff: paginatedStaff,
      clinics,
      total,
      count: paginatedStaff.length,
      limit,
      offset,
      breakdown: {
        totalStaff: staffResults.length,
        totalClinics: clinics.length
      },
      filters: { lat, lng, radius }
    });
    
  } catch (error) {
    console.error('❌ [STAFF-BY-PROBLEM] Error:', error);
    return c.json({ 
      success: false, 
      error: String(error),
      message: 'Failed to search staff by problem'
    }, 500);
  }
});

/**
 * Check if staff has matching specialization
 * Supports both new array format and legacy string format
 */
function checkStaffSpecialization(
  staff: any,
  staffSpecializations: string[],
  mappedSubCategories: string[],
  allVariations: Set<string>
): boolean {
  // ✅ METHOD 1: Check specializations array from SQL
  if (staffSpecializations && Array.isArray(staffSpecializations) && staffSpecializations.length > 0) {
    const hasMatch = staffSpecializations.some((spec: string) => {
      return mappedSubCategories.includes(spec) || allVariations.has(spec);
    });
    
    if (hasMatch) {
      console.log(`         Match via specializations array: ${staffSpecializations.join(', ')}`);
      return true;
    }
  }
  
  // ✅ METHOD 2: Check legacy specialization string field
  if (staff.specialization && typeof staff.specialization === 'string') {
    const specializationLower = staff.specialization.toLowerCase();
    
    // Check exact match with variations
    if (allVariations.has(staff.specialization)) {
      console.log(`         Match via specialization string (exact): ${staff.specialization}`);
      return true;
    }
    
    // Check partial match with subcategory IDs
    const hasPartialMatch = mappedSubCategories.some((subCatId: string) => {
      const subCatNormalized = subCatId.toLowerCase().replace(/[^a-z0-9]+/g, '_');
      const specNormalized = specializationLower.replace(/[^a-z0-9]+/g, '_');
      return specNormalized.includes(subCatNormalized) || subCatNormalized.includes(specNormalized);
    });
    
    if (hasPartialMatch) {
      console.log(`         Match via specialization string (partial): ${staff.specialization}`);
      return true;
    }
    
    // Check partial match with variation names
    for (const variation of allVariations) {
      const variationLower = variation.toLowerCase();
      if (specializationLower.includes(variationLower) || variationLower.includes(specializationLower)) {
        console.log(`         Match via specialization string (variation): ${staff.specialization} ~ ${variation}`);
        return true;
      }
    }
  }
  
  return false;
}

export default app;

console.log('✅ Universal Staff Problem Search endpoints (SQL-only) registered');
