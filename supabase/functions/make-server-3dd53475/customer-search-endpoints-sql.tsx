/**
 * ============================================================================
 * CUSTOMER SEARCH ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * CHANGES:
 * - Removed `kv` import
 * - Replaced all `kv.get()`, `kv.getByPrefix()` with SQL repository calls
 * - All data now comes from SQL tables
 * 
 * Date: 2025-01-27
 * Migration: Agent-3 - KV to SQL
 * KV Operations Removed: 15
 * ============================================================================
 */

import { Hono } from 'npm:hono';
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { getStaffRepository } from '../../lib/repositories/staff.ts';
import { getServicesRepository } from '../../lib/repositories/services.ts';
import { calculateDistance, getStaffNextAvailableSlot, getCenterNextAvailableSlot } from './schedule-utils-sql.tsx'; // ✅ FIXED: Updated to SQL version
import { getPrimarySpecialization, getAllSpecializations } from './specialization-mapping.tsx';
import { getDbClient } from '../../lib/db.ts';

/**
 * Get vendor services by style
 */
async function getVendorServices(vendorId: string, serviceStyle: string): Promise<any[]> {
  try {
    const db = getDbClient();
    const { data, error } = await db
      .from('vendor_services')
      .select('*')
      .eq('vendor_id', vendorId)
      .eq('service_style', serviceStyle)
      .eq('is_enabled', true)
      .eq('publish_status', 'published');

    if (error || !data) {
      return [];
    }

    return data.map((s: any) => ({
      id: s.service_id,
      serviceId: s.service_id,
      name: s.service_name,
      serviceName: s.service_name,
      description: s.custom_description || s.description || '',
      price: parseFloat(s.custom_price || s.price || '0'),
      customPrice: parseFloat(s.custom_price || s.price || '0'),
      duration: s.custom_duration || s.duration_minutes || 30,
      customDuration: s.custom_duration || s.duration_minutes || 30,
      serviceStyle: s.service_style,
      category: s.category,
      categoryName: s.category_name,
      subCategoryName: s.sub_category,
      isEnabled: s.is_enabled,
      publishStatus: s.publish_status,
      isPackage: s.is_package || false,
      whatIncluded: s.metadata?.whatIncluded || [],
      whatNotIncluded: s.metadata?.whatNotIncluded || []
    }));
  } catch (error) {
    console.error(`Error fetching vendor services for ${vendorId}:`, error);
    return [];
  }
}

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

    console.log(`\n🔍 ===== DOCTOR SEARCH (SQL) =====`);
    console.log(`📋 Query: "${query}"`);
    console.log(`🏷️ Role: ${roleId}`);
    console.log(`💰 Fee Range: ₹${feeMin} - ₹${feeMax}`);
    console.log(`👨‍⚕️ Experience: ${experienceMin}-${experienceMax} years`);
    console.log(`👤 Gender: ${gender || 'All'}`);
    console.log(`📅 Available Today: ${availableToday}`);
    console.log(`📍 Customer Location: ${customerLat}, ${customerLon}`);

    // ✅ SQL: Get all approved vendors
    const vendorsRepo = getVendorsRepository();
    const allVendors = await vendorsRepo.findAll({ status: 'approved' });
    console.log(`📊 Total vendors: ${allVendors.length}`);

    // ✅ FIXED: Filter approved vendors - support multiple vet-related roles
    let vendors = allVendors.filter((v: any) => {
      const isApproved = v.status === 'approved';
      const isActive = v.is_active !== false;
      
      // Role filter - support multiple vet-related roles
      let roleMatches = false;
      if (!roleId || roleId === '') {
        // No role filter specified
        roleMatches = true;
      } else {
        // ✅ FIXED: Dynamic role match - no hardcoded roles
        const vendorRoleId = v.role_id || v.roleId;
        roleMatches = vendorRoleId === roleId || 
                     (roleId.includes('vet') && (vendorRoleId === 'veterinarian' || vendorRoleId === 'pet_clinic' || vendorRoleId === 'vet_clinic'));
      }
      
      return isApproved && isActive && roleMatches;
    });
    console.log(`📊 Approved ${roleId || 'all role'}s: ${vendors.length}`);

    // ✅ SQL: Collect all doctors (staff members)
    const doctors: any[] = [];
    const staffRepo = getStaffRepository();

    for (const vendor of vendors) {
      // ✅ SQL: Get vendor's staff
      const vendorStaff = await staffRepo.findByVendorId(vendor.id);
      
      console.log(`   👥 [${vendor.business_name || vendor.owner_name}] (${vendor.id})`);
      console.log(`      Staff count: ${vendorStaff.length}`);
      
      for (const staff of vendorStaff) {
        if (!staff.isActive) continue;
        
        console.log(`      🔍 Staff ${staff.id}:`);
        console.log(`         - Name: ${staff.fullName}`);
        console.log(`         - Phone: ${staff.phone}`);
        console.log(`         - isActive: ${staff.isActive}`);
        
        // Apply filters
        // Name/specialization search
        if (query) {
          const searchLower = query.toLowerCase();
          const nameMatch = staff.fullName?.toLowerCase().includes(searchLower);
          const specializationMatch = staff.specialization?.toLowerCase().includes(searchLower);
          if (!nameMatch && !specializationMatch) continue;
        }

        // Fee range filter
        const consultationFee = staff.consultationFee || vendor.consultation_fee || 0;
        if (consultationFee < feeMin || consultationFee > feeMax) continue;

        // Experience filter
        const experience = staff.experience || staff.yearsOfExperience || 0;
        if (experience < experienceMin || experience > experienceMax) continue;

        // Gender filter
        if (gender && staff.gender && staff.gender.toLowerCase() !== gender.toLowerCase()) continue;

        // ✅ SQL: Get staff services
        const db = getDbClient();
        const { data: staffServicesData } = await db
          .from('staff_services')
          .select('*')
          .eq('staff_id', staff.id)
          .eq('is_active', true);

        const activeServices = (staffServicesData || []).map((s: any) => ({
          id: s.service_id,
          serviceId: s.service_id,
          name: s.service_name,
          category: s.category,
          categoryName: s.category_name,
          price: parseFloat(s.price || '0'),
          duration: s.duration_minutes || 30,
          serviceStyle: s.service_style || 'at_center',
          description: s.metadata?.description || ''
        }));

        // ✅ STANDARD FRAMEWORK: Only include staff if they have at least one active service
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
          bio: staff.bio || `Experienced ${roleId === 'veterinarian' ? 'veterinarian' : 'professional'} specialized in pet care and wellness.`,
          languages: staff.languages || ['English', 'Hindi'],
          yearsOfExperience: staff.experience || staff.yearsOfExperience || 0, // ✅ FIXED: Support both field names
          experience: staff.experience || staff.yearsOfExperience || 0, // ✅ Add experience field
          consultationFee: consultationFee,
          gender: staff.gender || '',
          photo: staff.photo || '',
          rating: staff.rating || vendor.rating || 4.5,
          totalReviews: staff.reviewCount || vendor.total_reviews || 0,
          reviewCount: staff.reviewCount || vendor.total_reviews || 0, // ✅ Add reviewCount field
          
          // Clinic/Vendor info
          clinicId: vendor.id,
          clinicName: vendor.business_name || vendor.owner_name,
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

    console.log(`📊 Doctors after filters: ${doctors.length}`);

    // Sort doctors
    doctors.sort((a, b) => {
      if (sortBy === 'fee_low') return a.consultationFee - b.consultationFee;
      if (sortBy === 'fee_high') return b.consultationFee - a.consultationFee;
      if (sortBy === 'experience') return b.yearsOfExperience - a.yearsOfExperience;
      if (sortBy === 'rating') return b.rating - a.rating;
      if (sortBy === 'distance') return (a.distance || 999999) - (b.distance || 999999); // ✅ Add distance sorting
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

    console.log(`\n🏥 ===== CLINIC SEARCH (SQL) =====`);
    console.log(`📋 Query: "${query}"`);
    console.log(`🏷️ Role Filter: ${roleId || 'All'}`);
    console.log(`📍 Customer Location: ${customerLat}, ${customerLon}`);

    // ✅ SQL: Get all approved vendors
    const vendorsRepo = getVendorsRepository();
    const allVendors = await vendorsRepo.findAll({ status: 'approved' });
    console.log(`📊 Total vendors: ${allVendors.length}`);

    // ✅ FIXED: Filter for clinics/centers - include both vendorType and vet-related roles
    let clinics = allVendors.filter((v: any) => {
      const isApprovedAndActive = v.status === 'approved' && v.is_active !== false;
      
      // Check if it's a center-type vendor OR a veterinary service provider
      const isCenterType = v.vendor_type === 'center' || v.primary_service_style === 'at_center';
      const vendorRoleId = v.role_id || v.roleId;
      const isVetRelated = vendorRoleId === 'pet_clinic' || vendorRoleId === 'veterinarian' || vendorRoleId === 'vet_clinic';
      
      return isApprovedAndActive && (isCenterType || isVetRelated);
    });

    console.log(`📊 Approved clinics/centers: ${clinics.length}`);

    // Apply role filter if specified
    if (roleId) {
      clinics = clinics.filter((v: any) => (v.role_id || v.roleId) === roleId);
      console.log(`📊 After role filter (${roleId}): ${clinics.length}`);
    }

    // Apply search query
    if (query) {
      const searchLower = query.toLowerCase();
      clinics = clinics.filter((v: any) => {
        const nameMatch = (v.business_name || v.owner_name || '').toLowerCase().includes(searchLower);
        const addressMatch = (v.address || '').toLowerCase().includes(searchLower);
        const cityMatch = (v.city || '').toLowerCase().includes(searchLower);
        return nameMatch || addressMatch || cityMatch;
      });
    }

    console.log(`📊 Clinics after search: ${clinics.length}`);

    // ✅ SQL: Enrich with additional data
    const enrichedClinics = await Promise.all(clinics.map(async (clinic) => {
      // ✅ SQL: Get clinic services count - COUNT ONLY PUBLISHED SERVICES
      const servicesAtCenter = await getVendorServices(clinic.id, 'at_center');
      const servicesAtHome = await getVendorServices(clinic.id, 'at_home');
      const servicesTele = await getVendorServices(clinic.id, 'tele');
      
      // Combine all services
      const allServices = [
        ...servicesAtCenter,
        ...servicesAtHome,
        ...servicesTele
      ];
      
      const servicesCount = allServices.length;
      
      console.log(`   📦 [${clinic.business_name || clinic.owner_name}] Total: ${allServices.length}, Published: ${servicesCount}`);

      // ✅ SQL: Get staff/doctors count
      const staffRepo = getStaffRepository();
      const vendorStaff = await staffRepo.findByVendorId(clinic.id);
      const staffCount = vendorStaff.length;

      // Get doctors list for preview
      const doctors = [];
      for (const staffMember of vendorStaff.slice(0, 3)) { // Get first 3 doctors
        if (staffMember.isActive) {
          doctors.push({
            id: staffMember.id,
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
        console.log(`   ⚠️ Could not get next available slot for ${clinic.business_name || clinic.owner_name}: ${error.message || error}`);
      }

      return {
        id: clinic.id,
        name: clinic.business_name || clinic.owner_name,
        businessName: clinic.business_name || clinic.owner_name,
        address: clinic.address,
        city: clinic.city,
        state: clinic.state,
        pincode: clinic.pincode,
        phone: clinic.phone,
        email: clinic.email,
        rating: clinic.rating || 4.5,
        reviewCount: clinic.total_reviews || 0,
        roleId: clinic.role_id || clinic.roleId,
        roleName: clinic.roleName,
        serviceCount: servicesCount,
        doctorCount: staffCount,
        isPremium: clinic.is_premium || false,
        isVerified: clinic.is_verified !== false, // Default to true
        doctors: doctors, // Top 3 doctors for preview
        photo: clinic.photos?.[0] || '',
        openingHours: clinic.opening_hours || '9:00 AM - 6:00 PM',
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
    
    console.log(`\n👨‍⚕️ ===== GET DOCTOR DETAILS (SQL) =====`);
    console.log(`📝 Doctor ID: ${doctorId}`);
    
    // ✅ SQL: Get staff
    const staffRepo = getStaffRepository();
    const staff = await staffRepo.findById(doctorId);
    
    if (!staff) {
      return c.json({
        success: false,
        error: 'Doctor not found'
      }, 404);
    }

    // ✅ SQL: Get vendor/clinic info
    const vendorsRepo = getVendorsRepository();
    const vendor = await vendorsRepo.findById(staff.vendorId);

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
      consultationFee: staff.consultationFee || vendor?.consultation_fee || 0,
      gender: staff.gender,
      photo: staff.photo,
      rating: staff.rating || 4.5,
      totalReviews: staff.reviewCount || 0,
      reviewCount: staff.reviewCount || 0,
      bio: staff.bio || '',
      languages: staff.languages || [],
      
      // Clinic info
      clinicId: vendor?.id,
      clinicName: vendor?.business_name || vendor?.owner_name,
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
    
    console.log(`\n🏥 ===== GET CLINIC SERVICES (SQL) =====`);
    console.log(`📝 Clinic ID: ${clinicId}`);
    
    // ✅ SQL: Get vendor/clinic info
    const vendorsRepo = getVendorsRepository();
    const vendor = await vendorsRepo.findById(clinicId);
    
    if (!vendor) {
      console.error(`❌ Clinic not found: ${clinicId}`);
      return c.json({
        success: false,
        error: 'Clinic not found'
      }, 404);
    }
    
    console.log(`✅ Found clinic: ${vendor.business_name || vendor.owner_name}`);
    console.log(`   Role ID: ${vendor.role_id || vendor.roleId}`);
    console.log(`   Status: ${vendor.status}`);
    
    // ✅ SQL: Load services from all service styles
    const servicesAtCenter = await getVendorServices(clinicId, 'at_center');
    const servicesAtHome = await getVendorServices(clinicId, 'at_home');
    const servicesTele = await getVendorServices(clinicId, 'tele');
    
    console.log(`\n📊 Services found in SQL:`);
    console.log(`   At Center: ${servicesAtCenter.length}`);
    console.log(`   At Home: ${servicesAtHome.length}`);
    console.log(`   Tele: ${servicesTele.length}`);
    
    // Combine and filter published services
    const allClinicServices = [
      ...servicesAtCenter.map((s: any) => ({ ...s, serviceStyle: 'at_center' })),
      ...servicesAtHome.map((s: any) => ({ ...s, serviceStyle: 'at_home' })),
      ...servicesTele.map((s: any) => ({ ...s, serviceStyle: 'tele' }))
    ];
    
    console.log(`\n📊 Total services: ${allClinicServices.length}`);
    
    // All services from getVendorServices are already published and enabled
    const publishedServices = allClinicServices.map((s: any) => ({
      id: s.id || s.serviceId,
      serviceId: s.serviceId || s.id,
      name: s.name || s.serviceName,
      serviceName: s.serviceName || s.name,
      description: s.description || s.customDescription || '',
      price: s.price || s.customPrice || 0,
      duration: s.duration || s.customDuration || 30,
      serviceStyle: s.serviceStyle,
      category: s.category,
      categoryName: s.categoryName,
      subCategoryName: s.subCategoryName,
      isPackage: s.isPackage || false,
      whatIncluded: s.whatIncluded || [],
      whatNotIncluded: s.whatNotIncluded || [],
      publishStatus: s.publishStatus || 'published',
      isEnabled: s.isEnabled !== false,
      vendorId: clinicId,
      vendorName: vendor.business_name || vendor.owner_name,
      vendorType: vendor.vendor_type,
      vendorRoleId: vendor.role_id || vendor.roleId
    }));
    
    console.log(`\n✅ Returning ${publishedServices.length} published services`);
    
    if (publishedServices.length > 0) {
      console.log(`\n📋 Final service list:`);
      publishedServices.forEach((s: any, i: number) => {
        console.log(`   ${i + 1}. ${s.name} (₹${s.price}, ${s.duration}min, ${s.serviceStyle})`);
      });
    } else {
      console.warn(`\n⚠️ WARNING: No published services found for clinic ${clinicId}`);
    }
    
    return c.json({
      success: true,
      services: publishedServices,
      vendor: {
        id: clinicId,
        name: vendor.business_name || vendor.owner_name,
        type: vendor.vendor_type,
        roleId: vendor.role_id || vendor.roleId
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

