/**
 * UNIVERSAL PROBLEM DISCOVERY ENDPOINT
 * ✅ UPDATED: Now works for ALL vendor types dynamically (not just vets)
 * Reuses the exact same logic across all roles
 */

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { calculateDistance, getStaffNextAvailableSlot } from './schedule-utils.tsx';
import { findProblemById, getProblemGridByRole } from './problem-grid-catalog.tsx';
import { getPrimarySpecialization, getAllSpecializations } from './specialization-mapping.tsx';

export function registerUniversalDiscovery(app: Hono) {
  /**
   * GET /make-server-3dd53475/customer/problem-grid/:roleId
   * 
   * Returns the problem grid catalog for a specific vendor role
   * Used by the Problem Grid UI to show relevant tiles
   */
  app.get('/make-server-3dd53475/customer/problem-grid/:roleId', (c) => {
    try {
      const { roleId } = c.req.param();
      console.log(`🔍 [PROBLEM-GRID] Fetching grid for role: ${roleId}`);
      
      const problems = getProblemGridByRole(roleId);
      
      console.log(`✅ [PROBLEM-GRID] Found ${problems.length} problems for ${roleId}`);
      
      return c.json({
        success: true,
        roleId,
        problems
      });
    } catch (error) {
      console.error('❌ [PROBLEM-GRID] Error:', error);
      return c.json({
        success: false,
        error: String(error)
      }, 500);
    }
  });

  /**
   * GET /make-server-3dd53475/customer/universal-problem-discovery
   * 
   * Discovers vendors/staff based on problem grid selection
   * ✅ NOW SUPPORTS ALL VENDOR TYPES via dynamic roleId parameter
   */
  app.get('/make-server-3dd53475/customer/universal-problem-discovery', async (c) => {
    return handleDiscovery(c);
  });

  /**
   * GET /make-server-3dd53475/customer/doctors/search
   * LEGACY ALIAS for Vet Search to prevent 404s
   */
  const legacyHandler = async (c: any) => {
    console.log(`⚠️ Legacy endpoint ${c.req.path} called, redirecting to Universal Discovery`);
    // Force roleId to 'veterinarian' for legacy compatibility if not present
    const url = new URL(c.req.url);
    if (!url.searchParams.has('roleId')) {
      url.searchParams.set('roleId', 'veterinarian');
    }
    // If it's a POST request, we might need to extract body params? 
    // But usually search is GET. If POST, we just return discovery.
    return handleDiscovery(c); 
  };

  /**
   * GET /make-server-3dd53475/customer/discover-by-problem/:roleId/:problemId
   * Compatibility endpoint for ProblemCategoryMapper
   */
  app.get('/make-server-3dd53475/customer/discover-by-problem/:roleId/:problemId', async (c) => {
    const roleId = c.req.param('roleId');
    const problemId = c.req.param('problemId');
    return handleDiscovery(c, { roleId, problemGridId: problemId });
  });

  app.get('/make-server-3dd53475/customer/doctors/search', legacyHandler);
  app.post('/make-server-3dd53475/customer/doctors/search', legacyHandler);
  
  // Catch-all for potential variations
  app.get('/make-server-3dd53475/doctors/search', legacyHandler); 
  app.post('/make-server-3dd53475/doctors/search', legacyHandler);

  async function handleDiscovery(c: any, overrides: any = {}) {
  try {
    const problemGridId = overrides.problemGridId || c.req.query('problemGridId');
    const roleId = overrides.roleId || c.req.query('roleId'); // ✅ DYNAMIC - no longer hardcoded to 'veterinarian'
    const feeMin = parseInt(c.req.query('feeMin') || '0');
    const feeMax = parseInt(c.req.query('feeMax') || '999999');
    const sortBy = c.req.query('sortBy') || 'rating';
    
    // Customer location for distance
    const customerLat = parseFloat(c.req.query('lat') || '0');
    const customerLon = parseFloat(c.req.query('lon') || '0');
    
    console.log('\n🔍 ===== UNIVERSAL PROBLEM DISCOVERY =====');
    console.log(`📋 Problem Grid: ${problemGridId}`);
    console.log(`🏷️  Role: ${roleId || 'NOT PROVIDED'}`);
    console.log(`📍 Customer Location: ${customerLat}, ${customerLon}`);
    
    if (!problemGridId && !roleId) {
      return c.json({
        success: false,
        error: 'Missing required parameter: problemGridId or roleId'
      }, 400);
    }
    
    // STEP 1: Get problem grid configuration (Optional if roleId is provided)
    let problemGrid = null;
    let requiredSubCategories: string[] = [];
    
    if (problemGridId) {
      problemGrid = findProblemById(problemGridId);
      
      if (!problemGrid) {
        console.log('⚠️ Problem grid not found in catalog, falling back to role-based search');
      } else {
        console.log(`✅ Problem Grid: "${problemGrid.displayName}"`);
        requiredSubCategories = problemGrid.mappedSubCategories || [];
      }
    }
    
    if (!problemGrid && roleId) {
      console.log(`ℹ️ Performing generic role-based search for: ${roleId}`);
    }
    
    // STEP 2: Get all vendors (EXACT SAME AS /customer/doctors/search)
    
    if (requiredSubCategories.length === 0) {
      console.log('⚠️  No subcategories mapped for this problem grid');
      return c.json({
        success: true,
        specialists: [],
        totalCount: 0,
        message: 'No specialists available for this problem'
      });
    }
    
    // STEP 2: Get all vendors (Use broader prefix and filter robustly)
    // Use 'vendor:' to catch all patterns, then filter down
    const allVendorRecords = await kv.getByPrefix('vendor:');
    console.log(`📊 Total vendor records scanned: ${allVendorRecords.length}`);

    // Filter approved vendors - robust filter for all formats
    let vendors = allVendorRecords.filter((v: any) => {
      // Basic object check
      if (!v || typeof v !== 'object') return false;
      
      // Check if it's a vendor record (has ID starting with vendor_)
      const id = v.id || v.vendorId;
      const isVendor = id && String(id).startsWith('vendor_');
      
      // Exclude indexes if key is present
      const key = v.key || '';
      const isIndex = key.includes(':phone:') || key.includes(':email:') || key.includes(':services:') || key.includes(':staff');
      
      if (!isVendor || isIndex) return false;

      // Status check
      const isApproved = v.status === 'approved';
      const isActive = v.isActive === true || v.isActive === 'true'; // Handle string/bool
      
      // Role filter
      let roleMatches = false;
      if (!roleId || roleId === '') {
        roleMatches = true;
      } else {
        const vendorRole = v.roleId || v.role || '';
        roleMatches = vendorRole === roleId || 
                     (roleId.includes('vet') && (vendorRole === 'veterinarian' || vendorRole === 'pet_clinic' || vendorRole === 'vet_clinic'));
      }
      
      return isApproved && isActive && roleMatches;
    });
    console.log(`📊 Approved ${roleId || 'all role'}s: ${vendors.length}`);

    // STEP 3: Collect all doctors (EXACT SAME AS /customer/doctors/search)
    const doctors: any[] = [];

    for (const vendor of vendors) {
      // Get vendor's staff
      const staffIds = await kv.get(`vendor:${vendor.id}:staff`) || [];
      
      console.log(`   👥 [${vendor.businessName || vendor.fullName}] (${vendor.id})`);
      console.log(`      Staff IDs in array: ${staffIds.length} → [${staffIds.join(', ')}]`);
      
      // CHECK 1: Process explicitly linked staff members
      for (const staffId of staffIds) {
        const staff = await kv.get(`staff:${staffId}`);
        
        console.log(`      🔍 Staff ${staffId}:`)
        console.log(`         - Exists: ${!!staff}`);
        if (staff) {
          console.log(`         - Name: ${staff.fullName}`);
          console.log(`         - isActive: ${staff.isActive}`);
          console.log(`         - Specializations: [${staff.specializations?.join(', ') || 'none'}]`);
        }
        
        if (staff) {
          // Robust active check
          const isStaffActive = staff.isActive === true || staff.isActive === 'true';
          
          if (isStaffActive) {
            // Fee range filter
            const consultationFee = staff.consultationFee || vendor.consultationFee || 0;
            if (consultationFee < feeMin || consultationFee > feeMax) continue;

          // Get staff services from staff.services array
          const staffServices = staff.services || [];
          const activeServices = staffServices
            .filter((s: any) => s.isActive === true)
            .map((s: any) => ({
              id: s.id || s.serviceId,
              serviceId: s.serviceId || s.id,
              name: s.serviceName || s.name,
              category: s.category,
              categoryName: s.categoryName,
              price: s.customPrice || s.price || 0,
              duration: s.customDuration || s.duration || 30,
              serviceStyle: s.serviceStyle || 'at_center',
              description: s.description || ''
            }));

          // Only include staff if they have at least one active service
          if (activeServices.length === 0) {
            console.log(`         ⚠️  SKIPPED - No active services found`);
            continue;
          }
          
          console.log(`         ✅ INCLUDED - Has ${activeServices.length} active services`);

          // Build doctor object
          const doctor = {
            id: staff.id,
            staffId: staff.id,
            fullName: staff.fullName,
            name: staff.fullName,
            specialization: getPrimarySpecialization(staff), // ✅ FIXED: Show actual specialization
            specializations: getAllSpecializations(staff), // ✅ NEW: All specializations
            qualification: staff.qualification || '',
            degree: staff.degree || staff.qualification || 'BVSc & AH',
            bio: staff.bio || staff.about || `Experienced ${roleId === 'veterinarian' ? 'veterinarian' : 'professional'} specialized in pet care and wellness.`,
            languages: staff.languages || ['English', 'Hindi'],
            yearsOfExperience: staff.yearsOfExperience || staff.experience || 0,
            experience: staff.yearsOfExperience || staff.experience || 0,
            consultationFee: consultationFee,
            gender: staff.gender || '',
            photo: staff.photo || '',
            rating: staff.rating || vendor.rating || 4.5,
            totalReviews: staff.totalReviews || vendor.totalReviews || 0,
            reviewCount: staff.totalReviews || vendor.totalReviews || 0,
            
            // Clinic/Vendor info
            clinicId: vendor.id,
            clinicName: vendor.businessName || vendor.fullName,
            clinicAddress: vendor.address,
            location: vendor.address || 'Location not specified',
            clinicCity: vendor.city,
            clinicState: vendor.state,
            clinicPincode: vendor.pincode,
            clinicPhone: vendor.phone,
            
            // Services for booking
            services: activeServices,
            serviceCount: activeServices.length,
            
            // Specializations (for filtering)
            specializations: staff.specializations || [],
            
            // Availability
            availableToday: true,
            availability: staff.availability || [],
            nextAvailableSlot: 'Today 2:00 PM'
          };

          // Calculate distance from customer location
          if (customerLat && customerLon) {
            const vendorLat = parseFloat(vendor.latitude || '0');
            const vendorLon = parseFloat(vendor.longitude || '0');
            if (vendorLat && vendorLon) {
              const distance = calculateDistance(customerLat, customerLon, vendorLat, vendorLon);
              doctor.distance = distance;
            }
          }

          doctors.push(doctor);
        }
      }
    }
    
    // CHECK 2: Solopreneur Fallback (Vendor as Provider)
    // If the vendor has NO staff, but HAS services, treat the vendor as the provider
    if (staffIds.length === 0) {
      const vendorServiceIds = await kv.get(`vendor:${vendor.id}:services`) || [];
      
      if (vendorServiceIds.length > 0) {
        console.log(`      👤 Solopreneur/Vendor-as-Provider: ${vendor.id} with ${vendorServiceIds.length} services`);
        
        // Load actual service objects
        const vendorServices = [];
        for (const svcId of vendorServiceIds) {
          const svc = await kv.get(`service:${svcId}`);
          if (svc && svc.isActive) {
            vendorServices.push({
              id: svc.id,
              serviceId: svc.id,
              name: svc.name,
              category: svc.category,
              categoryName: svc.categoryName || svc.category,
              price: svc.price || 0,
              duration: svc.duration || 30,
              serviceStyle: svc.serviceStyle || 'at_center',
              description: svc.description || ''
            });
          }
        }
        
        if (vendorServices.length > 0) {
           console.log(`         ✅ INCLUDED - Has ${vendorServices.length} active services (Solopreneur)`);
           
           // Fee range filter (check min price of services)
           const minServicePrice = Math.min(...vendorServices.map((s: any) => s.price));
           if (minServicePrice >= feeMin && minServicePrice <= feeMax) {
             
             // Build "Doctor" object from Vendor data
             const provider = {
                id: vendor.id,
                staffId: vendor.id, // Use vendor ID as staff ID
                fullName: vendor.fullName || vendor.businessName, // Prioritize name for person
                name: vendor.fullName || vendor.businessName,
                specialization: vendor.serviceCategory || roleId || 'General',
                specializations: [vendor.serviceCategory || roleId],
                qualification: vendor.qualification || '',
                degree: '', 
                bio: vendor.about || vendor.description || `Professional ${roleId || 'service provider'}`,
                languages: ['English'],
                yearsOfExperience: vendor.yearsOfExperience || vendor.experience || 0,
                experience: vendor.yearsOfExperience || vendor.experience || 0,
                consultationFee: minServicePrice, // Use lowest service price as "consultation fee"
                gender: '',
                photo: vendor.logo || vendor.profileImage || '', // Use logo/profile image
                rating: vendor.rating || 4.5,
                totalReviews: vendor.totalReviews || 0,
                reviewCount: vendor.totalReviews || 0,
                
                // Clinic/Vendor info
                clinicId: vendor.id,
                clinicName: vendor.businessName || vendor.fullName, // Prioritize business name for clinic
                clinicAddress: vendor.address,
                location: vendor.address || 'Location not specified',
                clinicCity: vendor.city,
                clinicState: vendor.state,
                clinicPincode: vendor.pincode,
                clinicPhone: vendor.phone,
                
                // Services
                services: vendorServices,
                serviceCount: vendorServices.length,
                
                // Specializations
                specializations: [vendor.serviceCategory || roleId],
                
                // Availability
                availableToday: true,
                availability: [], // Need to fetch vendor availability/operating hours ideally
                nextAvailableSlot: 'Today'
             };
             
            // Calculate distance
            if (customerLat && customerLon) {
              const vendorLat = parseFloat(vendor.latitude || '0');
              const vendorLon = parseFloat(vendor.longitude || '0');
              if (vendorLat && vendorLon) {
                const distance = calculateDistance(customerLat, customerLon, vendorLat, vendorLon);
                provider.distance = distance;
              }
            }
             
             doctors.push(provider);
           }
        }
      }
    }
  }

    console.log(`📊 Total doctors loaded: ${doctors.length}`);

    // STEP 4: Filter by problem grid subcategories (if applicable)
    let matchingDoctors = doctors;
    
    if (requiredSubCategories.length > 0) {
      console.log('\n🔍 Filtering by problem grid subcategories...');
      console.log(`   Required subcategories: [${requiredSubCategories.join(', ')}]`);
      
      matchingDoctors = doctors.filter((doctor: any) => {
        // Check if doctor has any services that match the required subcategories
        const doctorServices = doctor.services || [];
        
        // Check both staff specializations AND service categories
        const doctorSpecializations = doctor.specializations || [];
        const serviceCategories = doctorServices.map((s: any) => s.category).filter(Boolean);
        const allCategories = [...new Set([...doctorSpecializations, ...serviceCategories])];
        
        // Check if doctor has any of the required subcategories
        const hasMatch = requiredSubCategories.some((reqSubCat: string) => 
          allCategories.includes(reqSubCat)
        );
        
        if (hasMatch) {
          const matchedCategories = allCategories.filter((cat: string) => 
            requiredSubCategories.includes(cat)
          );
          console.log(`   ✅ ${doctor.fullName} - Matched: [${matchedCategories.join(', ')}]`);
        }
        
        return hasMatch;
      });
    } else {
      console.log('\nℹ️ No problem-specific filtering applied (Generic Search)');
    }
    
    console.log(`\n📊 FINAL RESULTS: ${matchingDoctors.length} specialists`);
    
    // Sort doctors
    matchingDoctors.sort((a, b) => {
      if (sortBy === 'fee_low') return a.consultationFee - b.consultationFee;
      if (sortBy === 'fee_high') return b.consultationFee - a.consultationFee;
      if (sortBy === 'experience') return b.yearsOfExperience - a.yearsOfExperience;
      if (sortBy === 'rating') return b.rating - a.rating;
      if (sortBy === 'distance' && a.distance && b.distance) return a.distance - b.distance;
      return 0;
    });
    
    // STEP 5: Format response
    const specialists = matchingDoctors.map((doctor: any) => {
      const doctorServices = doctor.services || [];
      const doctorSpecializations = doctor.specializations || [];
      const serviceCategories = doctorServices.map((s: any) => s.category).filter(Boolean);
      const allCategories = [...new Set([...doctorSpecializations, ...serviceCategories])];
      
      return {
        ...doctor,
        matchedSubCategories: requiredSubCategories.length > 0 ? allCategories.filter((cat: string) => 
          requiredSubCategories.includes(cat)
        ) : allCategories,
        problemGridId,
        problemGridName: problemGrid ? problemGrid.displayName : 'General Search'
      };
    });
    
    return c.json({
      success: true,
      specialists,
      totalCount: specialists.length,
      problemGrid: {
        id: problemGridId || 'generic',
        displayName: problemGrid ? problemGrid.displayName : 'General Search',
        description: problemGrid ? problemGrid.description : 'Find the best professionals for your pet',
        icon: problemGrid ? problemGrid.icon : '🔍',
        requiredSubCategories
      }
    });
    
    } catch (error) {
    console.error('❌ Error in universal problem discovery:', error);
    return c.json({
      success: false,
      error: String(error)
    }, 500);
  }
  }
}