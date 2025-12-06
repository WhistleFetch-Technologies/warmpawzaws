/**
 * VALIDATION MIDDLEWARE
 * 
 * Prevents data corruption by validating all staff and vendor operations
 * Used across all CRUD endpoints to ensure data consistency
 */

/**
 * Specialization Normalization Map
 */
const SPECIALIZATION_MAP: Record<string, string> = {
  'dentistry': 'sub_dentistry',
  'Dentistry': 'sub_dentistry',
  'dental': 'sub_dentistry',
  
  'cardiology': 'sub_cardiology',
  'Cardiology': 'sub_cardiology',
  
  'dermatology': 'sub_dermatology',
  'Dermatology': 'sub_dermatology',
  
  'orthopedics': 'sub_orthopedics',
  'Orthopedics': 'sub_orthopedics',
  
  'surgery': 'sub_surgical_services',
  'Surgery': 'sub_surgical_services',
  
  'medicine': 'sub_general_medicine',
  'Medicine': 'sub_general_medicine',
  'general medicine': 'sub_general_medicine',
  
  'ophthalmology': 'sub_ophthalmology',
  'Ophthalmology': 'sub_ophthalmology',
  
  'neurology': 'sub_neurology',
  'Neurology': 'sub_neurology',
  
  'oncology': 'sub_oncology',
  'Oncology': 'sub_oncology',
  
  'emergency': 'sub_emergency',
  'Emergency': 'sub_emergency',
  
  'internal medicine': 'sub_internal_medicine',
  'Internal Medicine': 'sub_internal_medicine',
  
  'radiology': 'sub_diagnostics',
  'Radiology': 'sub_diagnostics',
  
  'nutrition': 'sub_nutrition',
  'Nutrition': 'sub_nutrition',
  
  'behavior': 'sub_behavior',
  'Behavior': 'sub_behavior',
  
  'preventive': 'sub_preventive_wellness',
  'Preventive': 'sub_preventive_wellness',
  'wellness': 'sub_preventive_wellness',
  
  'gastroenterology': 'sub_gastroenterology',
  'Gastroenterology': 'sub_gastroenterology',
  
  'urology': 'sub_urology',
  'Urology': 'sub_urology',
  
  'reproductive': 'sub_reproductive',
  'Reproductive': 'sub_reproductive',
};

/**
 * Normalize a single specialization
 * ✅ CRITICAL FIX: Preserves new problem grid IDs
 */
export function normalizeSpecialization(spec: string): string {
  if (!spec) return '';
  
  // ✅ CRITICAL: If already in subcategory format (sub_xxx), return AS-IS
  // This is the correct format used by problem grid system
  if (spec.startsWith('sub_')) {
    return spec;
  }
  
  // ✅ CRITICAL: If it's a problem category ID (prob_xxx), return AS-IS  
  // New problem grid uses IDs like: prob_dental_care, prob_skin_issues
  // DO NOT MODIFY THESE - they're already in correct format!
  if (spec.startsWith('prob_')) {
    return spec;
  }
  
  // Only normalize LEGACY formats (old system without prefix)
  // Try exact match
  if (SPECIALIZATION_MAP[spec]) {
    return SPECIALIZATION_MAP[spec];
  }
  
  // Try lowercase match
  const lower = spec.toLowerCase();
  if (SPECIALIZATION_MAP[lower]) {
    return SPECIALIZATION_MAP[lower];
  }
  
  // Try partial match
  for (const [key, value] of Object.entries(SPECIALIZATION_MAP)) {
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) {
      return value;
    }
  }
  
  // Default: add sub_ prefix (should rarely happen now)
  console.warn(`[VALIDATION] Unknown specialization: "${spec}" - adding sub_ prefix`);
  return `sub_${lower.replace(/\s+/g, '_')}`;
}

/**
 * Normalize array of specializations
 */
export function normalizeSpecializations(specs: string[]): string[] {
  if (!specs || !Array.isArray(specs)) return [];
  
  const normalized = specs.map(s => normalizeSpecialization(s));
  return [...new Set(normalized)]; // Remove duplicates
}

/**
 * Validate staff data before save
 */
export function validateStaffData(staff: any): { valid: boolean; errors: string[]; data: any } {
  const errors: string[] = [];
  
  // Validate ID format
  if (staff.id && !staff.id.startsWith('staff_')) {
    errors.push('Staff ID must start with "staff_"');
  }
  
  // Validate specializations
  if (!staff.specializations || !Array.isArray(staff.specializations) || staff.specializations.length === 0) {
    if (staff.specialization) {
      // Auto-fix: Create from primary
      staff.specializations = [staff.specialization];
    } else {
      errors.push('Staff must have at least one specialization');
    }
  }
  
  // ✅ FIXED: Only normalize if NOT already in problem grid format
  if (staff.specializations) {
    staff.specializations = normalizeSpecializations(staff.specializations);
  }
  
  // Normalize primary specialization
  if (staff.specialization) {
    staff.specialization = normalizeSpecialization(staff.specialization);
  }
  
  // Validate services have serviceStyle
  if (staff.services && Array.isArray(staff.services)) {
    for (const service of staff.services) {
      if (!service.serviceStyle) {
        // This will need to be derived from vendor services
        // For now, flag as warning but don't block
        console.warn(`Service "${service.serviceName}" missing serviceStyle for staff ${staff.id}`);
      }
    }
  }
  
  // Validate required fields
  if (!staff.fullName) errors.push('fullName is required');
  if (!staff.vendorId) errors.push('vendorId is required');
  if (!staff.role) errors.push('role is required');
  
  return {
    valid: errors.length === 0,
    errors: errors,
    data: staff
  };
}

/**
 * Validate vendor staff array
 */
export function validateVendorStaffArray(staffIds: string[]): { valid: boolean; errors: string[]; data: string[] } {
  const errors: string[] = [];
  const validIds: string[] = [];
  
  for (const id of staffIds) {
    if (typeof id !== 'string') {
      errors.push(`Invalid staff ID type: ${typeof id}`);
      continue;
    }
    
    // Valid formats:
    // 1. staff_xxxxx (standard staff ID)
    // 2. vendor_xxxxx_staff_self (self-employed vendor's staff profile)
    // 
    // Invalid formats:
    // 1. staffsvc_xxxxx (service ID, not staff ID)
    
    if (id.startsWith('staffsvc_')) {
      errors.push(`Invalid staff ID format: ${id} (service ID, not staff ID)`);
      continue;
    }
    
    if (id.startsWith('staff_') || id.includes('_staff_self')) {
      validIds.push(id);
    } else {
      errors.push(`Invalid staff ID format: ${id} (must start with "staff_" or contain "_staff_self")`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors: errors,
    data: validIds
  };
}

/**
 * Auto-fix staff data issues before save
 */
export async function autoFixStaffData(staff: any): Promise<any> {
  const fixed = { ...staff };
  
  // Fix missing default values
  if (typeof fixed.isActive === 'undefined') {
    fixed.isActive = true;
  }
  
  if (!fixed.totalAppointments) {
    fixed.totalAppointments = 0;
  }
  
  if (!fixed.completedAppointments) {
    fixed.completedAppointments = 0;
  }
  
  if (!fixed.totalEarnings) {
    fixed.totalEarnings = 0;
  }
  
  if (!fixed.rating) {
    fixed.rating = 0;
  }
  
  if (!fixed.reviewCount) {
    fixed.reviewCount = 0;
  }
  
  if (!fixed.assignedServices) {
    fixed.assignedServices = [];
  }
  
  // ✅ NEW: Preserve specializations array as-is (already validated/normalized)
  // Don't overwrite with empty array if specializations exist
  if (!fixed.specializationDetails) {
    fixed.specializationDetails = [];
  }
  
  return fixed;
}

/**
 * Derive service style from service data
 */
export function deriveServiceStyle(service: any): 'at_home' | 'at_center' | 'tele' | null {
  // Check explicit serviceStyle field
  if (service.serviceStyle) {
    return service.serviceStyle;
  }
  
  // Try to derive from service name/description
  const text = `${service.serviceName || ''} ${service.description || ''}`.toLowerCase();
  
  if (text.includes('home') || text.includes('visit')) {
    return 'at_home';
  }
  
  if (text.includes('tele') || text.includes('video') || text.includes('online') || text.includes('call')) {
    return 'tele';
  }
  
  // Default to at_center
  return 'at_center';
}
