/**
 * DOCTOR DISCOVERY ENDPOINTS - SQL-ONLY VERSION
 * 
 * ✅ MIGRATED TO SQL: All KV operations replaced with SQL queries
 * 
 * Find doctors/clinics by health problem specialization
 * Supports multiple discovery modes:
 * - Staff-driven: Find staff tagged with specialization
 * - Service-driven: Find staff offering services for that health problem
 * - Hybrid: Combination of both
 * 
 * Date: 2025-01-27
 * Migration: KV to SQL (8 KV operations → 0)
 * Endpoints: 1
 */

import { Hono } from 'npm:hono';
import { getDbClient } from '../../lib/db.ts';
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { getStaffRepository } from '../../lib/repositories/staff.ts';
import { getServicesRepository } from '../../lib/repositories/services.ts';

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
    
    // ✅ SQL: Verify health problem exists (from platform_settings or services)
    const db = getDbClient();
    const { data: healthProblem } = await db
      .from('platform_settings')
      .select('setting_value')
      .eq('setting_key', `health_problem:${specialization}`)
      .single();
    
    if (!healthProblem) {
      return c.json({ 
        success: false, 
        error: 'Health problem not found' 
      }, 404);
    }
    
    // ✅ SQL: Get all approved vendors with veterinarian/clinic roles
    const vendors = await getVendorsRepository().findAll({ 
      status: 'approved' 
    });
    
    const approvedVendors = vendors.filter((v: any) => {
      const roleId = v.role_id || v.role || '';
      return roleId === 'veterinarian' || roleId === 'pet_clinic' || 
             roleId === 'role_veterinarian' || roleId === 'role_vet_clinic';
    });
    
    console.log(`   Found ${approvedVendors.length} approved vet vendors`);
    
    // ✅ SQL: Find matching doctors/clinics
    const matchingDoctors: any[] = [];
    
    for (const vendor of approvedVendors) {
      // Check if vendor is a clinic with staff
      if (vendor.role_id === 'pet_clinic' || vendor.role_id === 'role_vet_clinic') {
        // ✅ SQL: Get clinic staff
        const staffMembers = await getStaffRepository().findByVendorId(vendor.id);
        
        for (const staffMember of staffMembers) {
          if (!staffMember.isActive) continue;
          
          // Check if staff has this specialization
          const hasSpecialization = checkSpecialization(staffMember, specialization);
          
          if (hasSpecialization) {
            // ✅ SQL: Get staff service styles from metadata
            const { data: staffData } = await db
              .from('staff')
              .select('metadata')
              .eq('id', staffMember.id)
              .single();
            
            const serviceStyles = (staffData?.metadata as any)?.style_preferences?.enabledStyles || ['at_center'];
            
            // Filter by service style if specified
            if (serviceStyleFilter && !serviceStyles.includes(serviceStyleFilter)) {
              continue;
            }
            
            matchingDoctors.push({
              type: 'clinic_doctor',
              doctorId: staffMember.id,
              doctorName: staffMember.fullName,
              doctorPhoto: staffMember.photo,
              specialization: staffMember.specialization,
              specializations: staffMember.specializations || [],
              clinicId: vendor.id,
              clinicName: vendor.business_name,
              clinicAddress: vendor.address,
              clinicLocation: { latitude: vendor.latitude, longitude: vendor.longitude },
              serviceStyles: serviceStyles,
              consultationFee: staffMember.consultationFee || 500,
              rating: staffMember.rating || vendor.average_rating || 4.5,
              reviewCount: staffMember.reviewCount || vendor.total_reviews || 0,
              experience: staffMember.experience,
              qualifications: staffMember.specialization,
              availability: staffMember.availability
            });
          }
        }
      } else {
        // Individual veterinarian
        const hasSpecialization = checkSpecialization(vendor, specialization);
        
        if (hasSpecialization) {
          matchingDoctors.push({
            type: 'individual_vet',
            doctorId: vendor.id,
            doctorName: vendor.owner_name,
            doctorPhoto: vendor.profile_photo_url,
            specialization: vendor.specialization,
            clinicName: vendor.business_name,
            clinicAddress: vendor.address,
            clinicLocation: { latitude: vendor.latitude, longitude: vendor.longitude },
            serviceStyles: ['at_center', 'at_home'],
            consultationFee: 500,
            rating: vendor.average_rating || 4.5,
            reviewCount: vendor.total_reviews || 0,
            experience: vendor.experience_years || 0
          });
        }
      }
    }
    
    // Filter by distance if location provided
    let filteredDoctors = matchingDoctors;
    if (location) {
      const [lat, lng] = location.split(',').map(parseFloat);
      filteredDoctors = matchingDoctors.filter((doctor: any) => {
        if (!doctor.clinicLocation || !doctor.clinicLocation.latitude) return false;
        const distance = calculateDistance(
          lat, lng,
          doctor.clinicLocation.latitude,
          doctor.clinicLocation.longitude
        );
        return distance <= radius;
      });
    }
    
    // Sort by rating (highest first)
    filteredDoctors.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    
    console.log(`✅ Found ${filteredDoctors.length} matching doctors`);
    
    return c.json({
      success: true,
      doctors: filteredDoctors,
      totalCount: filteredDoctors.length,
      specialization,
      filters: {
        location: location || null,
        radius,
        serviceStyle: serviceStyleFilter || 'all'
      }
    });
    
  } catch (error) {
    console.error('❌ [DISCOVERY] Error:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to discover doctors' 
    }, 500);
  }
});

// Helper: Check if staff/vendor has specialization
function checkSpecialization(entity: any, specialization: string): boolean {
  const entitySpecialization = entity.specialization || '';
  const entitySpecializations = entity.specializations || [];
  
  const normalizedSearch = specialization.toLowerCase();
  const normalizedEntity = entitySpecialization.toLowerCase();
  
  if (normalizedEntity.includes(normalizedSearch) || normalizedSearch.includes(normalizedEntity)) {
    return true;
  }
  
  return entitySpecializations.some((spec: string) => 
    spec.toLowerCase().includes(normalizedSearch) || 
    normalizedSearch.includes(spec.toLowerCase())
  );
}

// Helper: Calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

console.log('✅ Doctor discovery endpoints registered (SQL-only)');

export default app;
