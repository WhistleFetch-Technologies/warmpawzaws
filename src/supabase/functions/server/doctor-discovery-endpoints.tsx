/**
 * 🔍 DOCTOR DISCOVERY ENDPOINTS
 * 
 * Find doctors/clinics by health problem specialization
 * Supports multiple discovery modes:
 * - Staff-driven: Find staff tagged with specialization
 * - Service-driven: Find staff offering services for that health problem
 * - Hybrid: Combination of both
 */

// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
import { Hono } from 'hono';
import { 
  getVendorsRepository,
  getStaffRepository,
  getVendorServicesRepository
} from '../../../supabase/lib/repositories/index';
import { getDbClient } from '../../../supabase/lib/db';

const app = new Hono();

/**
 * 🔍 Discover doctors by health problem specialization
 * GET /customer/doctors/by-specialization/:specialization
 * 
 * Query params:
 * - location: lat,lng (for distance filtering)
 * - radius: in km (default: 50)
 * - serviceStyle: at_center, at_home, tele (optional filter)
 */
app.get('/make-server-3dd53475/customer/doctors/by-specialization/:specialization', async (c) => {
  try {
    const specialization = c.req.param('specialization');
    const location = c.req.query('location'); // "lat,lng"
    const radius = parseFloat(c.req.query('radius') || '50');
    const serviceStyleFilter = c.req.query('serviceStyle'); // optional
    
    console.log(`🔍 [DISCOVERY] Finding doctors for specialization: ${specialization}`);
    console.log(`   Location: ${location}, Radius: ${radius}km, Style: ${serviceStyleFilter || 'all'}`);
    
    // ✅ SQL: Step 1: Verify health problem exists (check problem_grid or health_problems table)
    const db = getDbClient();
    const { data: healthProblem } = await db
      .from('health_problems')
      .select('*')
      .eq('id', specialization)
      .single();
    
    if (!healthProblem) {
      return c.json({ 
        success: false, 
        error: 'Health problem not found' 
      }, 404);
    }
    
    // ✅ SQL: Step 2: Get all approved vendors from vendors table
    const vendorsRepo = getVendorsRepository();
    const allVendors = await vendorsRepo.findAll({});
    const approvedVendors = allVendors.filter((v: any) => 
      v.approval_status === 'approved' && 
      (v.role_id === 'veterinarian' || v.role_id === 'pet_clinic' || 
       v.role_id === 'role_veterinarian' || v.role_id === 'role_vet_clinic')
    );
    
    console.log(`   Found ${approvedVendors.length} approved vet vendors`);
    
    // Step 3: Find matching doctors/clinics
    const matchingDoctors: any[] = [];
    
    for (const vendor of approvedVendors) {
      // ✅ SQL: Check if vendor is a clinic with staff
      if (vendor.role_id === 'pet_clinic' || vendor.role_id === 'role_vet_clinic') {
        // ✅ SQL: Get clinic staff from staff table
        const staffRepo = getStaffRepository();
        const staff = await staffRepo.findByVendor(vendor.id);
        
        for (const staffMember of staff) {
          if (staffMember.status !== 'active' || !staffMember.is_active) continue;
          
          // Check if staff has this specialization
          const hasSpecialization = checkSpecialization(staffMember, specialization);
          
          if (hasSpecialization) {
            // Get staff service styles
            const serviceStyles = staffMember.metadata?.serviceStyles || ['at_center'];
            
            // Filter by service style if specified
            if (serviceStyleFilter && !serviceStyles.includes(serviceStyleFilter)) {
              continue;
            }
            
            matchingDoctors.push({
              type: 'clinic_doctor',
              doctorId: staffMember.id,
              doctorName: staffMember.full_name,
              doctorPhoto: staffMember.photo || staffMember.metadata?.profilePhoto,
              specialization: staffMember.metadata?.specialization,
              specializations: staffMember.metadata?.specializations || [],
              clinicId: vendor.id,
              clinicName: vendor.business_name,
              clinicAddress: vendor.address,
              clinicLocation: vendor.location,
              serviceStyles: serviceStyles,
              consultationFee: staffMember.metadata?.consultationFee || 500,
              rating: staffMember.metadata?.rating || vendor.average_rating || 4.5,
              reviewCount: staffMember.metadata?.reviewCount || vendor.metadata?.reviewCount || 0,
              experience: staffMember.metadata?.experience,
              qualifications: staffMember.metadata?.qualifications,
              availability: staffMember.metadata?.availability
            });
          }
        }
      } else {
        // Individual veterinarian
        const hasSpecialization = checkVendorSpecialization(vendor, specialization);
        
        if (hasSpecialization) {
          // ✅ SQL: Get vendor service styles from vendor_services table
          const vendorServicesRepo = getVendorServicesRepository();
          const vendorServices = await vendorServicesRepo.findByVendor(vendor.id);
          const serviceStyles = new Set<string>();
          vendorServices.forEach((service: any) => {
            if (service.is_enabled && service.service_style) {
              serviceStyles.add(service.service_style);
            }
          });
          
          const stylesArray = Array.from(serviceStyles);
          if (stylesArray.length === 0) stylesArray.push('at_center');
          
          // Filter by service style if specified
          if (serviceStyleFilter && !stylesArray.includes(serviceStyleFilter)) {
            continue;
          }
          
          matchingDoctors.push({
            type: 'individual_veterinarian',
            doctorId: vendor.id,
            doctorName: vendor.business_name || vendor.full_name,
            doctorPhoto: vendor.logo,
            specialization: vendor.metadata?.specialization || 'Veterinarian',
            specializations: vendor.metadata?.specializations || [],
            serviceStyles: stylesArray,
            consultationFee: vendor.metadata?.consultationFee || 500,
            rating: vendor.average_rating || 4.5,
            reviewCount: vendor.metadata?.reviewCount || 0,
            address: vendor.address,
            location: vendor.location,
            experience: vendor.metadata?.experience,
            qualifications: vendor.metadata?.qualifications
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
  // ✅ SQL: Check specializations from metadata
  const specializations = staff.metadata?.specializations || [];
  if (Array.isArray(specializations) && specializations.includes(specialization)) {
    return true;
  }
  
  // Fallback: Check old specialization field
  const specializationField = staff.metadata?.specialization;
  if (specializationField) {
    const normalized = specializationField.toLowerCase().replace(/[^a-z0-9]+/g, '_');
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
  // ✅ SQL: Check specializations from metadata
  const specializations = vendor.metadata?.specializations || [];
  if (Array.isArray(specializations) && specializations.includes(specialization)) {
    return true;
  }
  
  // Fallback: Check old specialization field
  const specializationField = vendor.metadata?.specialization;
  if (specializationField) {
    const normalized = specializationField.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    if (normalized === specialization || normalized.includes(specialization)) {
      return true;
    }
  }
  
  // Default: If no specialization set, include in general medicine
  if (specialization === 'medicine' && !specializationField && specializations.length === 0) {
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
      // ✅ SQL: Find staff member from staff table
      const staffRepo = getStaffRepository();
      const staff = await staffRepo.findById(doctorId);
      
      if (!staff) {
        return c.json({ success: false, error: 'Doctor not found' }, 404);
      }
      
      // ✅ SQL: Get clinic info from vendors table
      const vendorsRepo = getVendorsRepository();
      const clinic = await vendorsRepo.findById(staff.vendor_id);
      
      return c.json({
        success: true,
        doctor: {
          type: 'clinic_doctor',
          doctorId: staff.id,
          doctorName: staff.full_name,
          doctorPhoto: staff.photo || staff.metadata?.profilePhoto,
          specialization: staff.metadata?.specialization,
          specializations: staff.metadata?.specializations || [],
          clinicId: clinic?.id,
          clinicName: clinic?.business_name,
          clinicAddress: clinic?.address,
          clinicLocation: clinic?.location,
          serviceStyles: staff.metadata?.serviceStyles || ['at_center'],
          consultationFee: staff.metadata?.consultationFee || 500,
          rating: staff.metadata?.rating || clinic?.average_rating || 4.5,
          reviewCount: staff.metadata?.reviewCount || clinic?.metadata?.reviewCount || 0,
          experience: staff.metadata?.experience,
          qualifications: staff.metadata?.qualifications,
          bio: staff.metadata?.bio,
          availability: staff.metadata?.availability
        }
      });
    } else {
      // ✅ SQL: Individual veterinarian from vendors table
      const vendorsRepo = getVendorsRepository();
      const vendor = await vendorsRepo.findById(doctorId);
      
      if (!vendor) {
        return c.json({ success: false, error: 'Doctor not found' }, 404);
      }
      
      // ✅ SQL: Get service styles from vendor_services table
      const vendorServicesRepo = getVendorServicesRepository();
      const vendorServices = await vendorServicesRepo.findByVendor(vendor.id);
      const serviceStyles = new Set<string>();
      vendorServices.forEach((service: any) => {
        if (service.is_enabled && service.service_style) {
          serviceStyles.add(service.service_style);
        }
      });
      
      const stylesArray = Array.from(serviceStyles);
      if (stylesArray.length === 0) stylesArray.push('at_center');
      
      return c.json({
        success: true,
        doctor: {
          type: 'individual_veterinarian',
          doctorId: vendor.id,
          doctorName: vendor.business_name || vendor.full_name,
          doctorPhoto: vendor.logo,
          specialization: vendor.metadata?.specialization || 'Veterinarian',
          specializations: vendor.metadata?.specializations || [],
          serviceStyles: stylesArray,
          consultationFee: vendor.metadata?.consultationFee || 500,
          rating: vendor.average_rating || 4.5,
          reviewCount: vendor.metadata?.reviewCount || 0,
          address: vendor.address,
          location: vendor.location,
          experience: vendor.metadata?.experience,
          qualifications: vendor.metadata?.qualifications,
          bio: vendor.metadata?.bio
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