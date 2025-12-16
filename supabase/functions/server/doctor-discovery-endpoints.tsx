/**
 * 🔍 DOCTOR DISCOVERY ENDPOINTS
 * 
 * Find doctors/clinics by health problem specialization
 * Supports multiple discovery modes:
 * - Staff-driven: Find staff tagged with specialization
 * - Service-driven: Find staff offering services for that health problem
 * - Hybrid: Combination of both
 */

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';

const app = new Hono();

/**
 * 🔍 Discover doctors by health problem specialization
 * GET /customer/doctors/by-specialization/:specialization
 * 
 * Query params:
 * - location: lat,lng (for distance filtering)
 * - radius: in km (default: 20, maximum: 20 for home services)
 * - serviceStyle: at_center, at_home, tele (optional filter)
 */
app.get('/make-server-3dd53475/customer/doctors/by-specialization/:specialization', async (c) => {
  try {
    const specialization = c.req.param('specialization');
    const location = c.req.query('location'); // "lat,lng"
    // ✅ BUSINESS RULE: Maximum radius for home services discovery is 20KM
    let radius = parseFloat(c.req.query('radius') || '20');
    if (radius > 20) {
      radius = 20; // Cap at 20KM maximum
    }
    const serviceStyleFilter = c.req.query('serviceStyle'); // optional
    
    console.log(`🔍 [DISCOVERY] Finding doctors for specialization: ${specialization}`);
    console.log(`   Location: ${location}, Radius: ${radius}km, Style: ${serviceStyleFilter || 'all'}`);
    
    // Step 1: Verify health problem exists
    const healthProblem = await kv.get(`health_problem:${specialization}`);
    if (!healthProblem) {
      return c.json({ 
        success: false, 
        error: 'Health problem not found' 
      }, 404);
    }
    
    // Step 2: Get all approved vendors
    const allVendors = await kv.getByPrefix('vendor:');
    const approvedVendors = allVendors.filter((v: any) => 
      v.approvalStatus === 'approved' && 
      (v.roleId === 'veterinarian' || v.roleId === 'pet_clinic' || 
       v.roleId === 'role_veterinarian' || v.roleId === 'role_vet_clinic')
    );
    
    console.log(`   Found ${approvedVendors.length} approved vet vendors`);
    
    // Step 3: Find matching doctors/clinics
    const matchingDoctors: any[] = [];
    
    for (const vendor of approvedVendors) {
      // Check if vendor is a clinic with staff
      if (vendor.roleId === 'pet_clinic' || vendor.roleId === 'role_vet_clinic') {
        // Get clinic staff
        const staff = await kv.getByPrefix(`staff:${vendor.id}:`);
        
        for (const staffMember of staff) {
          if (staffMember.status !== 'active') continue;
          
          // Check if staff has this specialization
          const hasSpecialization = checkSpecialization(staffMember, specialization);
          
          if (hasSpecialization) {
            // Get staff service styles
            const serviceStyles = staffMember.serviceStyles || ['at_center'];
            
            // Filter by service style if specified
            if (serviceStyleFilter && !serviceStyles.includes(serviceStyleFilter)) {
              continue;
            }
            
            matchingDoctors.push({
              type: 'clinic_doctor',
              doctorId: staffMember.id,
              doctorName: staffMember.fullName,
              doctorPhoto: staffMember.profilePhoto,
              specialization: staffMember.specialization,
              specializations: staffMember.specializations || [],
              clinicId: vendor.id,
              clinicName: vendor.businessName,
              clinicAddress: vendor.address,
              clinicLocation: vendor.location,
              serviceStyles: serviceStyles,
              consultationFee: staffMember.consultationFee || 500,
              rating: staffMember.rating || vendor.rating || 4.5,
              reviewCount: staffMember.reviewCount || vendor.reviewCount || 0,
              experience: staffMember.experience,
              qualifications: staffMember.qualifications,
              availability: staffMember.availability
            });
          }
        }
      } else {
        // Individual veterinarian
        // For individual vets, check their profile specialization
        // Since they don't have staff, we check the vendor profile directly
        const hasSpecialization = checkVendorSpecialization(vendor, specialization);
        
        if (hasSpecialization) {
          // Get vendor service styles from their services
          const vendorServices = await kv.getByPrefix(`vendor_service:${vendor.id}:`);
          const serviceStyles = new Set<string>();
          vendorServices.forEach((service: any) => {
            if (service.isEnabled && service.serviceStyle) {
              serviceStyles.add(service.serviceStyle);
            }
          });
          
          const stylesArray = Array.from(serviceStyles);
          if (stylesArray.length === 0) stylesArray.push('at_center'); // Default
          
          // Filter by service style if specified
          if (serviceStyleFilter && !stylesArray.includes(serviceStyleFilter)) {
            continue;
          }
          
          matchingDoctors.push({
            type: 'individual_veterinarian',
            doctorId: vendor.id,
            doctorName: vendor.businessName || vendor.contactPerson,
            doctorPhoto: vendor.logo,
            specialization: vendor.specialization || 'Veterinarian',
            specializations: vendor.specializations || [],
            serviceStyles: stylesArray,
            consultationFee: vendor.consultationFee || 500,
            rating: vendor.rating || 4.5,
            reviewCount: vendor.reviewCount || 0,
            address: vendor.address,
            location: vendor.location,
            experience: vendor.experience,
            qualifications: vendor.qualifications
          });
        }
      }
    }
    
    console.log(`   Found ${matchingDoctors.length} matching doctors`);
    
    // Step 4: Apply location filtering if provided
    let filteredDoctors = matchingDoctors;
    if (location) {
      const [userLat, userLng] = location.split(',').map(parseFloat);
      
      filteredDoctors = matchingDoctors.filter((doctor: any) => {
        const loc = doctor.clinicLocation || doctor.location;
        if (!loc || !loc.lat || !loc.lng) return false;
        
        const distance = calculateDistance(
          userLat, userLng, 
          loc.lat, loc.lng
        );
        
        doctor.distance = distance;
        return distance <= radius;
      });
      
      // Sort by distance
      filteredDoctors.sort((a: any, b: any) => a.distance - b.distance);
      
      console.log(`   After location filter: ${filteredDoctors.length} doctors`);
    }
    
    // Step 5: Sort by rating if no location provided
    if (!location) {
      filteredDoctors.sort((a: any, b: any) => b.rating - a.rating);
    }
    
    return c.json({
      success: true,
      healthProblem,
      doctors: filteredDoctors,
      total: filteredDoctors.length,
      filters: {
        specialization,
        location: location || null,
        radius,
        serviceStyle: serviceStyleFilter || 'all'
      }
    });
  } catch (error) {
    console.error('❌ Error discovering doctors:', error);
    return c.json({ 
      success: false, 
      error: String(error) 
    }, 500);
  }
});

/**
 * Check if staff member has specialization
 */
function checkSpecialization(staff: any, specialization: string): boolean {
  // Check new specializations array (primary method)
  if (staff.specializations && Array.isArray(staff.specializations)) {
    if (staff.specializations.includes(specialization)) {
      return true;
    }
  }
  
  // Fallback: Check old specialization field (backward compatibility)
  if (staff.specialization) {
    const normalized = staff.specialization.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    if (normalized === specialization || normalized.includes(specialization)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Check if vendor (individual vet) has specialization
 */
function checkVendorSpecialization(vendor: any, specialization: string): boolean {
  // Check new specializations array
  if (vendor.specializations && Array.isArray(vendor.specializations)) {
    if (vendor.specializations.includes(specialization)) {
      return true;
    }
  }
  
  // Fallback: Check old specialization field
  if (vendor.specialization) {
    const normalized = vendor.specialization.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    if (normalized === specialization || normalized.includes(specialization)) {
      return true;
    }
  }
  
  // Default: If no specialization set, include in general medicine
  if (specialization === 'medicine' && !vendor.specialization && !vendor.specializations) {
    return true;
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

/**
 * 🔍 Get doctor profile with specialization info
 * GET /customer/doctors/:doctorId/profile
 */
app.get('/make-server-3dd53475/customer/doctors/:doctorId/profile', async (c) => {
  try {
    const doctorId = c.req.param('doctorId');
    const type = c.req.query('type'); // 'clinic_doctor' or 'individual_veterinarian'
    
    console.log(`🔍 [DISCOVERY] Fetching doctor profile: ${doctorId}, type: ${type}`);
    
    if (type === 'clinic_doctor') {
      // Find staff member
      const allStaff = await kv.getByPrefix('staff:');
      const staff = allStaff.find((s: any) => s.id === doctorId);
      
      if (!staff) {
        return c.json({ success: false, error: 'Doctor not found' }, 404);
      }
      
      // Get clinic info
      const clinic = await kv.get(`vendor:${staff.vendorId}`);
      
      return c.json({
        success: true,
        doctor: {
          type: 'clinic_doctor',
          doctorId: staff.id,
          doctorName: staff.fullName,
          doctorPhoto: staff.profilePhoto,
          specialization: staff.specialization,
          specializations: staff.specializations || [],
          clinicId: clinic?.id,
          clinicName: clinic?.businessName,
          clinicAddress: clinic?.address,
          clinicLocation: clinic?.location,
          serviceStyles: staff.serviceStyles || ['at_center'],
          consultationFee: staff.consultationFee || 500,
          rating: staff.rating || 4.5,
          reviewCount: staff.reviewCount || 0,
          experience: staff.experience,
          qualifications: staff.qualifications,
          bio: staff.bio,
          availability: staff.availability
        }
      });
    } else {
      // Individual veterinarian
      const vendor = await kv.get(`vendor:${doctorId}`);
      
      if (!vendor) {
        return c.json({ success: false, error: 'Doctor not found' }, 404);
      }
      
      // Get service styles from vendor services
      const vendorServices = await kv.getByPrefix(`vendor_service:${vendor.id}:`);
      const serviceStyles = new Set<string>();
      vendorServices.forEach((service: any) => {
        if (service.isEnabled && service.serviceStyle) {
          serviceStyles.add(service.serviceStyle);
        }
      });
      
      const stylesArray = Array.from(serviceStyles);
      if (stylesArray.length === 0) stylesArray.push('at_center');
      
      return c.json({
        success: true,
        doctor: {
          type: 'individual_veterinarian',
          doctorId: vendor.id,
          doctorName: vendor.businessName || vendor.contactPerson,
          doctorPhoto: vendor.logo,
          specialization: vendor.specialization || 'Veterinarian',
          specializations: vendor.specializations || [],
          serviceStyles: stylesArray,
          consultationFee: vendor.consultationFee || 500,
          rating: vendor.rating || 4.5,
          reviewCount: vendor.reviewCount || 0,
          address: vendor.address,
          location: vendor.location,
          experience: vendor.experience,
          qualifications: vendor.qualifications,
          bio: vendor.bio
        }
      });
    }
  } catch (error) {
    console.error('❌ Error fetching doctor profile:', error);
    return c.json({ 
      success: false, 
      error: String(error) 
    }, 500);
  }
});

/**
 * 🎯 Get single problem by ID from problem grid
 * GET /problem/:problemId
 * 
 * Used when user clicks a problem from landing page shortcuts
 * Returns full problem object needed for vendor discovery
 */
app.get('/make-server-3dd53475/problem/:problemId', async (c) => {
  try {
    const problemId = c.req.param('problemId');
    console.log(`🎯 [PROBLEM] Fetching problem: ${problemId}`);
    
    // Import problem grid catalog
    const { findProblemById } = await import('./problem-grid-catalog.tsx');
    
    const problem = findProblemById(problemId);
    
    if (!problem) {
      console.error(`❌ [PROBLEM] Problem not found: ${problemId}`);
      return c.json({ 
        success: false, 
        error: `Problem ${problemId} not found` 
      }, 404);
    }
    
    console.log(`✅ [PROBLEM] Found problem:`, problem.name);
    
    return c.json(problem);
  } catch (error) {
    console.error('❌ Error fetching problem:', error);
    return c.json({ 
      success: false, 
      error: String(error) 
    }, 500);
  }
});

export default app;