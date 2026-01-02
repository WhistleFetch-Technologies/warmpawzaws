import { Hono } from 'hono';
import * as kv from './kv_store';
import { calculateDistance, getStaffNextAvailableSlot, getCenterNextAvailableSlot } from './schedule-utils';
import { getPrimarySpecialization, getAllSpecializations } from './specialization-mapping';

export function registerCustomerSearchEndpoints(app: Hono) {

/**
 * GET /make-server-3dd53475/customer/doctors/search
 * Search for doctors (veterinarians, groomers, trainers, etc.)
 */
app.get('/make-server-3dd53475/customer/doctors/search', async (c) => {
  try {
    const query = c.req.query('query') || '';
    const roleId = c.req.query('roleId') || 'veterinarian';
    const feeMin = parseInt(c.req.query('feeMin') || '0');
    const feeMax = parseInt(c.req.query('feeMax') || '999999');
    const experienceMin = parseInt(c.req.query('experienceMin') || '0');
    const experienceMax = parseInt(c.req.query('experienceMax') || '999');
    const gender = c.req.query('gender') || '';
    const availableToday = c.req.query('availableToday') === 'true';
    const sortBy = c.req.query('sortBy') || 'rating';
    const limit = parseInt(c.req.query('limit') || '20');
    const offset = parseInt(c.req.query('offset') || '0');
    
    // ✅ Customer location for distance calculation
    const customerLat = parseFloat(c.req.query('lat') || '0');
    const customerLon = parseFloat(c.req.query('lon') || '0');

    console.log(`\n🔍 ===== DOCTOR SEARCH =====`);
    console.log(`📋 Query: "${query}"`);
    console.log(`🏷️ Role: ${roleId}`);
    console.log(`💰 Fee Range: ₹${feeMin} - ₹${feeMax}`);
    console.log(`👨‍⚕️ Experience: ${experienceMin}-${experienceMax} years`);
    console.log(`👤 Gender: ${gender || 'All'}`);
    console.log(`📅 Available Today: ${availableToday}`);
    console.log(`📍 Customer Location: ${customerLat}, ${customerLon}`);

    // Get all vendors
    const allVendors = await kv.getByPrefix('vendor:vendor_');
    console.log(`📊 Total vendors: ${allVendors.length}`);

    // ✅ FIXED: Filter approved vendors - support multiple vet-related roles
    let vendors = allVendors.filter((v: any) => {
      const isApproved = v.status === 'approved';
      const isActive = v.isActive === true;
      
      // Role filter - support multiple vet-related roles
      let roleMatches = false;
      if (!roleId || roleId === '') {
        // No role filter specified
        roleMatches = true;
      } else {
        // ✅ FIXED: Dynamic role match - no hardcoded roles
        // Support exact match OR related roles (e.g., 'veterinarian' matches 'pet_clinic', 'vet_clinic')
        roleMatches = v.roleId === roleId || 
                     (roleId.includes('vet') && (v.roleId === 'veterinarian' || v.roleId === 'pet_clinic' || v.roleId === 'vet_clinic'));
      }
      
      return isApproved && isActive && roleMatches;
    });
    console.log(`📊 Approved ${roleId || 'all role'}s: ${vendors.length}`);

    // Collect all doctors (staff members)
    const doctors: any[] = [];

    for (const vendor of vendors) {
      // Get vendor's staff
      const staffIds = await kv.get(`vendor:${vendor.id}:staff`) || [];
      
      console.log(`   👥 [${vendor.businessName || vendor.fullName}] (${vendor.id})`);
      console.log(`      Staff IDs in array: ${staffIds.length} → [${staffIds.join(', ')}]`);
      
      for (const staffId of staffIds) {
        const staff = await kv.get(`staff:${staffId}`);
        
        console.log(`      🔍 Staff ${staffId}:`);
        console.log(`         - Exists: ${!!staff}`);
        if (staff) {
          console.log(`         - Name: ${staff.fullName}`);
          console.log(`         - Phone: ${staff.phone}`);
          console.log(`         - isActive: ${staff.isActive}`);
          console.log(`         - Will be included: ${staff.isActive ? 'YES' : 'NO (inactive)'}`);
        }
        
        if (staff && staff.isActive) {
          // Apply filters
          // Name/specialization search
          if (query) {
            const searchLower = query.toLowerCase();
            const nameMatch = staff.fullName?.toLowerCase().includes(searchLower);
            const specializationMatch = staff.specialization?.toLowerCase().includes(searchLower);
            if (!nameMatch && !specializationMatch) continue;
          }

          // Fee range filter
          const consultationFee = staff.consultationFee || vendor.consultationFee || 0;
          if (consultationFee < feeMin || consultationFee > feeMax) continue;

          // Experience filter
          const experience = staff.yearsOfExperience || staff.experience || 0;
          if (experience < experienceMin || experience > experienceMax) continue;

          // Gender filter
          if (gender && staff.gender && staff.gender.toLowerCase() !== gender.toLowerCase()) continue;

          // ✅ UPDATED: Get staff services from staff.services array
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

          // ✅ STANDARD FRAMEWORK: Only include staff if they have at least one active service
          // This applies across all vendor types (vet, groomer, trainer, walker, etc.)
          if (activeServices.length === 0) {
            console.log(`         ⚠️ SKIPPED - No active services found`);
            continue;
          }
          
          console.log(`         ✅ INCLUDED - Has ${activeServices.length} active services`);

          // Build doctor object
          const doctor = {
            id: staff.id,
            staffId: staff.id,
            fullName: staff.fullName,
            name: staff.fullName, // ✅ FIXED: Add name field for compatibility
            specialization: getPrimarySpecialization(staff), // ✅ FIXED: Show actual specialization
            specializations: getAllSpecializations(staff), // ✅ NEW: All specializations for filtering
            qualification: staff.qualification || '',
            degree: staff.degree || staff.qualification || 'BVSc & AH',
            bio: staff.bio || staff.about || `Experienced ${roleId === 'veterinarian' ? 'veterinarian' : 'professional'} specialized in pet care and wellness.`,
            languages: staff.languages || ['English', 'Hindi'],
            yearsOfExperience: staff.yearsOfExperience || staff.experience || 0, // ✅ FIXED: Support both field names
            experience: staff.yearsOfExperience || staff.experience || 0, // ✅ Add experience field
            consultationFee: consultationFee,
            gender: staff.gender || '',
            photo: staff.photo || '',
            rating: staff.rating || vendor.rating || 4.5,
            totalReviews: staff.totalReviews || vendor.totalReviews || 0,
            reviewCount: staff.totalReviews || vendor.totalReviews || 0, // ✅ Add reviewCount field
            
            // Clinic/Vendor info
            clinicId: vendor.id,
            clinicName: vendor.businessName || vendor.fullName,
            clinicAddress: vendor.address,
            location: vendor.address || 'Location not specified', // ✅ Add location field
            clinicCity: vendor.city,
            clinicState: vendor.state,
            clinicPincode: vendor.pincode,
            clinicPhone: vendor.phone,
            
            // ✅ Services for booking
            services: activeServices,
            serviceCount: activeServices.length,
            
            // Availability (simplified - would need to check schedule)
            availableToday: true, // Placeholder
            availability: staff.availability || [],
            nextAvailableSlot: 'Today 2:00 PM' // Placeholder
          };

          // ✅ Calculate distance from customer location
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

    console.log(`📊 Doctors after filters: ${doctors.length}`);

    // Sort doctors
    doctors.sort((a, b) => {
      if (sortBy === 'fee_low') return a.consultationFee - b.consultationFee;
      if (sortBy === 'fee_high') return b.consultationFee - a.consultationFee;
      if (sortBy === 'experience') return b.yearsOfExperience - a.yearsOfExperience;
      if (sortBy === 'rating') return b.rating - a.rating;
      if (sortBy === 'distance') return a.distance - b.distance; // ✅ Add distance sorting
      return 0; // relevance
    });

    // Paginate
    const total = doctors.length;
    const paginatedDoctors = doctors.slice(offset, offset + limit);

    console.log(`✅ Returning ${paginatedDoctors.length} doctors (page ${Math.floor(offset / limit) + 1})`);

    return c.json({
      success: true,
      doctors: paginatedDoctors,
      total,
      count: paginatedDoctors.length,
      limit,
      offset
    });

  } catch (error) {
    console.error('❌ [DOCTOR-SEARCH] Error:', error);
    return c.json({
      success: false,
      error: 'Failed to search doctors',
      message: String(error)
    }, 500);
  }
});

/**
 * GET /make-server-3dd53475/customer/clinics/search
 * Search for clinics/centers
 */
app.get('/make-server-3dd53475/customer/clinics/search', async (c) => {
  try {
    const query = c.req.query('query') || '';
    const roleId = c.req.query('roleId') || '';
    const sortBy = c.req.query('sortBy') || 'rating';
    const limit = parseInt(c.req.query('limit') || '20');
    const offset = parseInt(c.req.query('offset') || '0');
    
    // ✅ Customer location for distance calculation
    const customerLat = parseFloat(c.req.query('lat') || '0');
    const customerLon = parseFloat(c.req.query('lon') || '0');

    console.log(`\n🏥 ===== CLINIC SEARCH =====`);
    console.log(`📋 Query: "${query}"`);
    console.log(`🏷️ Role Filter: ${roleId || 'All'}`);
    console.log(`📍 Customer Location: ${customerLat}, ${customerLon}`);

    // Get all vendors
    const allVendors = await kv.getByPrefix('vendor:vendor_');
    console.log(`📊 Total vendors: ${allVendors.length}`);

    // ✅ FIXED: Filter for clinics/centers - include both vendorType and vet-related roles
    let clinics = allVendors.filter((v: any) => {
      const isApprovedAndActive = v.status === 'approved' && v.isActive === true;
      
      // Check if it's a center-type vendor OR a veterinary service provider
      const isCenterType = v.vendorType === 'center' || v.primaryServiceStyle === 'at_center';
      const isVetRelated = v.roleId === 'pet_clinic' || v.roleId === 'veterinarian' || v.roleId === 'vet_clinic';
      
      return isApprovedAndActive && (isCenterType || isVetRelated);
    });

    console.log(`📊 Approved clinics/centers: ${clinics.length}`);

    // Apply role filter if specified
    if (roleId) {
      clinics = clinics.filter((v: any) => v.roleId === roleId);
      console.log(`📊 After role filter (${roleId}): ${clinics.length}`);
    }

    // Apply search query
    if (query) {
      const searchLower = query.toLowerCase();
      clinics = clinics.filter((v: any) => {
        const nameMatch = (v.businessName || v.fullName || '').toLowerCase().includes(searchLower);
        const addressMatch = (v.address || '').toLowerCase().includes(searchLower);
        const cityMatch = (v.city || '').toLowerCase().includes(searchLower);
        return nameMatch || addressMatch || cityMatch;
      });
    }

    console.log(`📊 Clinics after search: ${clinics.length}`);

    // Enrich with additional data
    const enrichedClinics = await Promise.all(clinics.map(async (clinic) => {
      // ✅ FIXED: Get clinic services count - COUNT ONLY PUBLISHED SERVICES (not just enabled)
      const servicesAtCenter = await kv.get(`vendor_services:${clinic.id}:at_center`) || { services: [] };
      const servicesAtHome = await kv.get(`vendor_services:${clinic.id}:at_home`) || { services: [] };
      const servicesTele = await kv.get(`vendor_services:${clinic.id}:tele`) || { services: [] };
      
      // Combine all services and count only published ones (same logic as customer-facing API)
      const allServices = [
        ...(servicesAtCenter.services || []),
        ...(servicesAtHome.services || []),
        ...(servicesTele.services || [])
      ];
      
      const servicesCount = allServices.filter((s: any) => 
        s.isEnabled === true && s.publishStatus === 'published'
      ).length;
      
      console.log(`   📦 [${clinic.businessName || clinic.fullName}] Total: ${allServices.length}, Published: ${servicesCount}`);

      // Get staff/doctors count
      const staffIds = await kv.get(`vendor:${clinic.id}:staff`) || [];
      const staffCount = staffIds.length;

      // Get doctors list for preview
      const doctors = [];
      for (const staffId of staffIds.slice(0, 3)) { // Get first 3 doctors
        const staffMember = await kv.get(`staff:${staffId}`);
        if (staffMember && staffMember.isActive) {
          doctors.push({
            id: staffId,
            name: staffMember.fullName,
            specialization: staffMember.specialization,
            photo: staffMember.photo || null
          });
        }
      }

      // ✅ Calculate distance from customer location
      let distance = null;
      if (customerLat && customerLon) {
        const clinicLat = parseFloat(clinic.latitude || '0');
        const clinicLon = parseFloat(clinic.longitude || '0');
        if (clinicLat && clinicLon) {
          distance = calculateDistance(customerLat, customerLon, clinicLat, clinicLon);
        }
      }

      // ✅ Get next available slot using center schedule management
      let nextAvailableSlot = null;
      try {
        const nextSlot = await getCenterNextAvailableSlot(clinic.id, 30);
        if (nextSlot) {
          nextAvailableSlot = nextSlot.slot;
        }
      } catch (error) {
        console.log(`   ⚠️ Could not get next available slot for ${clinic.businessName || clinic.fullName}: ${error.message || error}`);
      }

      return {
        id: clinic.id,
        name: clinic.businessName || clinic.fullName,
        businessName: clinic.businessName || clinic.fullName,
        address: clinic.address,
        city: clinic.city,
        state: clinic.state,
        pincode: clinic.pincode,
        phone: clinic.phone,
        email: clinic.email,
        rating: clinic.rating || 4.5,
        reviewCount: clinic.totalReviews || 0,
        roleId: clinic.roleId,
        roleName: clinic.roleName,
        serviceCount: servicesCount,
        doctorCount: staffCount,
        isPremium: clinic.isPremium || false,
        isVerified: clinic.isVerified !== false, // Default to true
        doctors: doctors, // Top 3 doctors for preview
        photo: clinic.photos?.[0] || '',
        openingHours: clinic.openingHours || '9:00 AM - 6:00 PM',
        amenities: clinic.amenities || [],
        distance: distance, // ✅ Distance from customer
        nextAvailableSlot: nextAvailableSlot // ✅ Next available slot
      };
    }));

    // ✅ CRITICAL: Filter out clinics with 0 active services (STANDARD FRAMEWORK requirement)
    const clinicsWithServices = enrichedClinics.filter(clinic => {
      const hasServices = clinic.serviceCount > 0;
      if (!hasServices) {
        console.log(`   ❌ FILTERED OUT: [${clinic.name}] - No active published services`);
      }
      return hasServices;
    });
    
    console.log(`📊 Clinics after service filter: ${clinicsWithServices.length} (filtered out ${enrichedClinics.length - clinicsWithServices.length} with 0 services)`);

    // Sort
    clinicsWithServices.sort((a, b) => {
      if (sortBy === 'rating') return b.rating - a.rating;
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'distance' && a.distance && b.distance) return a.distance - b.distance; // ✅ Add distance sorting
      return 0;
    });

    // Paginate
    const total = clinicsWithServices.length;
    const paginatedClinics = clinicsWithServices.slice(offset, offset + limit);

    console.log(`✅ Returning ${paginatedClinics.length} clinics`);

    return c.json({
      success: true,
      clinics: paginatedClinics,
      total,
      count: paginatedClinics.length,
      limit,
      offset
    });

  } catch (error) {
    console.error('❌ [CLINIC-SEARCH] Error:', error);
    return c.json({
      success: false,
      error: 'Failed to search clinics',
      message: String(error)
    }, 500);
  }
});

/**
 * GET /make-server-3dd53475/customer/doctors/:doctorId
 * Get doctor details
 */
app.get('/make-server-3dd53475/customer/doctors/:doctorId', async (c) => {
  try {
    const { doctorId } = c.req.param();
    
    console.log(`\n👨‍⚕️ ===== GET DOCTOR DETAILS =====`);
    console.log(`📝 Doctor ID: ${doctorId}`);
    
    const staff = await kv.get(`staff:${doctorId}`);
    
    if (!staff) {
      return c.json({
        success: false,
        error: 'Doctor not found'
      }, 404);
    }

    // Get vendor/clinic info
    const vendor = await kv.get(`vendor:${staff.vendorId}`);

    const doctor = {
      id: staff.id,
      fullName: staff.fullName,
      name: staff.fullName || staff.name,
      specialization: getPrimarySpecialization(staff), // ✅ FIXED: Use mapping function
      specializations: getAllSpecializations(staff), // ✅ NEW: All specializations
      qualification: staff.qualification,
      degree: staff.degree || staff.qualification,
      yearsOfExperience: staff.yearsOfExperience || staff.experience || 0,
      experience: staff.experience || staff.yearsOfExperience || 0,
      consultationFee: staff.consultationFee || vendor?.consultationFee || 0,
      gender: staff.gender,
      photo: staff.photo,
      rating: staff.rating || 4.5,
      totalReviews: staff.totalReviews || 0,
      reviewCount: staff.totalReviews || 0,
      bio: staff.bio || '',
      languages: staff.languages || [],
      
      // Clinic info
      clinicId: vendor?.id,
      clinicName: vendor?.businessName || vendor?.fullName,
      clinicAddress: vendor?.address,
      clinicLatitude: vendor?.latitude, // ✅ Add coordinates
      clinicLongitude: vendor?.longitude,
      clinicPhone: vendor?.phone
    };

    console.log(`✅ Doctor found: ${doctor.fullName}`);

    return c.json({
      success: true,
      doctor
    });

  } catch (error) {
    console.error('❌ [GET-DOCTOR] Error:', error);
    return c.json({
      success: false,
      error: 'Failed to get doctor details',
      message: String(error)
    }, 500);
  }
});

/**
 * GET /make-server-3dd53475/customer/clinic/:clinicId/services
 * Get all services for a specific clinic
 */
app.get('/make-server-3dd53475/customer/clinic/:clinicId/services', async (c) => {
  try {
    const { clinicId } = c.req.param();
    
    console.log(`\n🏥 ===== GET CLINIC SERVICES =====`);
    console.log(`📝 Clinic ID: ${clinicId}`);
    
    // Get vendor/clinic info
    const vendor = await kv.get(`vendor:${clinicId}`);
    
    if (!vendor) {
      console.error(`❌ Clinic not found: ${clinicId}`);
      return c.json({
        success: false,
        error: 'Clinic not found'
      }, 404);
    }
    
    console.log(`✅ Found clinic: ${vendor.businessName || vendor.fullName}`);
    console.log(`   Vendor Type: ${vendor.vendorType}`);
    console.log(`   Role ID: ${vendor.roleId}`);
    console.log(`   Status: ${vendor.status}`);
    console.log(`   Created: ${vendor.createdAt}`);
    
    // Load services from all service styles
    const servicesAtCenter = await kv.get(`vendor_services:${clinicId}:at_center`) || { services: [] };
    const servicesAtHome = await kv.get(`vendor_services:${clinicId}:at_home`) || { services: [] };
    const servicesTele = await kv.get(`vendor_services:${clinicId}:tele`) || { services: [] };
    
    console.log(`\n📊 Services found in KV store:`);
    console.log(`   At Center: ${servicesAtCenter.services?.length || 0}`);
    console.log(`   At Home: ${servicesAtHome.services?.length || 0}`);
    console.log(`   Tele: ${servicesTele.services?.length || 0}`);
    
    // Log details of each service style
    if (servicesAtCenter.services?.length > 0) {
      console.log(`\n📦 At Center Services:`);
      servicesAtCenter.services.forEach((s: any, i: number) => {
        console.log(`   ${i + 1}. ${s.name} - enabled=${s.isEnabled}, published=${s.publishStatus}`);
      });
    }
    
    if (servicesAtHome.services?.length > 0) {
      console.log(`\n🏠 At Home Services:`);
      servicesAtHome.services.forEach((s: any, i: number) => {
        console.log(`   ${i + 1}. ${s.name} - enabled=${s.isEnabled}, published=${s.publishStatus}`);
      });
    }
    
    if (servicesTele.services?.length > 0) {
      console.log(`\n📞 Tele Services:`);
      servicesTele.services.forEach((s: any, i: number) => {
        console.log(`   ${i + 1}. ${s.name} - enabled=${s.isEnabled}, published=${s.publishStatus}`);
      });
    }
    
    // Combine and filter published services
    const allClinicServices = [
      ...(servicesAtCenter.services || []).map((s: any) => ({ ...s, serviceStyle: 'at_center' })),
      ...(servicesAtHome.services || []).map((s: any) => ({ ...s, serviceStyle: 'at_home' })),
      ...(servicesTele.services || []).map((s: any) => ({ ...s, serviceStyle: 'tele' }))
    ];
    
    console.log(`\n📊 Total services before filtering: ${allClinicServices.length}`);
    
    // Filter only published and enabled services
    const publishedServices = allClinicServices.filter((s: any) => {
      const isEnabled = s.isEnabled;
      const isPublished = s.publishStatus === 'published';
      const result = isEnabled && isPublished;
      
      if (!result) {
        console.log(`   ❌ Filtering out: ${s.name || s.serviceName} (enabled=${isEnabled}, published=${isPublished})`);
      }
      
      return result;
    }).map((s: any) => ({
      id: s.id || s.serviceId,
      serviceId: s.serviceId || s.id,
      name: s.name || s.serviceName,
      serviceName: s.serviceName || s.name,
      description: s.description || s.customDescription || '',
      price: s.customPrice || s.price || 0,
      duration: s.customDuration || s.duration || 30,
      serviceStyle: s.serviceStyle,
      category: s.category,
      categoryName: s.categoryName,
      subCategoryName: s.subCategoryName,
      isPackage: s.isPackage || false,
      whatIncluded: s.whatIncluded || [],
      whatNotIncluded: s.whatNotIncluded || [],
      publishStatus: s.publishStatus,
      isEnabled: s.isEnabled,
      vendorId: clinicId,
      vendorName: vendor.businessName || vendor.fullName,
      vendorType: vendor.vendorType,
      vendorRoleId: vendor.roleId
    }));
    
    console.log(`\n✅ Returning ${publishedServices.length} published services`);
    
    if (publishedServices.length > 0) {
      console.log(`\n📋 Final service list:`);
      publishedServices.forEach((s: any, i: number) => {
        console.log(`   ${i + 1}. ${s.name} (₹${s.price}, ${s.duration}min, ${s.serviceStyle})`);
      });
    } else {
      console.warn(`\n⚠️ WARNING: No published services found for clinic ${clinicId}`);
      console.warn(`   This could mean:`);
      console.warn(`   1. No services have been enabled in the vendor dashboard`);
      console.warn(`   2. Services are not published (publishStatus !== 'published')`);
      console.warn(`   3. Service records are not properly stored in KV`);
    }
    
    return c.json({
      success: true,
      services: publishedServices,
      vendor: {
        id: clinicId,
        name: vendor.businessName || vendor.fullName,
        type: vendor.vendorType,
        roleId: vendor.roleId
      }
    });
    
  } catch (error) {
    console.error('❌ [GET-CLINIC-SERVICES] Error:', error);
    return c.json({
      success: false,
      error: 'Failed to get clinic services',
      message: String(error)
    }, 500);
  }
});


}
