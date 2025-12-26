/**
 * Veterinary Specialization Mapping Utility
 * Maps internal specialization codes to human-readable display names
 * Maintains correlation with problem grids for search functionality
 */

export const VET_SPECIALIZATION_MAP: Record<string, string> = {
  // Medical Specialties
  "sub_cardiology": "Cardiologist",
  "sub_neurology": "Neurologist",
  "sub_ophthalmology": "Ophthalmologist",
  "sub_dermatology": "Dermatologist",
  "sub_dentistry": "Dentist",
  "sub_orthopedics": "Orthopedic Surgeon",
  "sub_surgery": "Surgeon",
  "sub_oncology": "Oncologist",
  "sub_internal_medicine": "Internal Medicine Specialist",
  "sub_emergency": "Emergency & Critical Care",
  "sub_radiology": "Radiologist",
  "sub_anesthesiology": "Anesthesiologist",
  
  // Animal-Specific Specialties
  "sub_avian": "Avian Specialist",
  "sub_exotic": "Exotic Animal Specialist",
  "sub_equine": "Equine Specialist",
  "sub_livestock": "Large Animal Specialist",
  
  // General Practice
  "sub_general_practice": "General Practitioner",
  "sub_medicine": "General Practitioner",
  "sub_general_medicine": "General Medicine",
  
  // Additional Services
  "sub_preventive": "Preventive Care Specialist",
  "sub_preventive_wellness": "Preventive Care Specialist",
  "sub_behavior": "Animal Behaviorist",
  "sub_nutrition": "Veterinary Nutritionist",
  "sub_rehabilitation": "Rehabilitation Specialist",
  "sub_surgical_services": "Surgeon",
  "sub_diagnostics": "Diagnostic Specialist",
  "sub_emergency_critical_care": "Emergency & Critical Care",
  
  // Common aliases (without sub_ prefix for backward compatibility)
  "cardiology": "Cardiologist",
  "cardiologist": "Cardiologist",
  "neurology": "Neurologist",
  "neurologist": "Neurologist",
  "ophthalmology": "Ophthalmologist",
  "dermatology": "Dermatologist",
  "dentistry": "Dentist",
  "dentist": "Dentist",
  "orthopedics": "Orthopedic Surgeon",
  "surgery": "Surgeon",
  "surgeon": "Surgeon",
  "sergery": "Surgeon", // ✅ FIX: Common typo
  "surgical_services": "Surgeon",
  "oncology": "Oncologist",
  "internal_medicine": "Internal Medicine Specialist",
  "general_medicine": "General Medicine",
  "emergency": "Emergency & Critical Care",
  "emergency_critical_care": "Emergency & Critical Care",
  "radiology": "Radiologist",
  "anesthesiology": "Anesthesiologist",
  "diagnostics": "Diagnostic Specialist",
  "preventive_wellness": "Preventive Care Specialist",
  "urologist": "Urologist"
};

/**
 * Get human-readable display name for a specialization code
 * Handles multiple formats: sub_cardiology, cardiology, Cardiology, etc.
 * 
 * @param specCode - The specialization code (e.g., "sub_cardiology" or "cardiology")
 * @returns Display name (e.g., "Cardiologist")
 */
export function getSpecializationDisplayName(specCode: string): string {
  if (!specCode || specCode.trim() === '') {
    console.log(`[SPEC-MAP] Empty spec code → returning "General Practitioner"`);
    return "General Practitioner";
  }
  
  // ✅ FIX: If it's already a display name (capitalized, contains spaces), return as-is
  const original = specCode.trim();
  console.log(`[SPEC-MAP] Processing: "${original}"`);
  
  if (original.includes(' ') || /^[A-Z]/.test(original)) {
    // It's already a display name like "Dentist", "Surgical Services", "Neurologist"
    // Just return it (fix common typos)
    if (original.toLowerCase() === 'sergery') {
      console.log(`[SPEC-MAP] Typo fix: "Sergery" → "Surgeon"`);
      return 'Surgeon';
    }
    if (original.toLowerCase() === 'surgery') {
      console.log(`[SPEC-MAP] Mapping: "Surgery" → "Surgeon"`);
      return 'Surgeon';
    }
    console.log(`[SPEC-MAP] Display name detected → returning "${original}" as-is`);
    return original;
  }
  
  // Normalize: lowercase and trim
  const normalized = specCode.toLowerCase().trim();
  
  // Direct match
  if (VET_SPECIALIZATION_MAP[normalized]) {
    return VET_SPECIALIZATION_MAP[normalized];
  }
  
  // Try with sub_ prefix
  const withPrefix = normalized.startsWith('sub_') ? normalized : `sub_${normalized}`;
  if (VET_SPECIALIZATION_MAP[withPrefix]) {
    return VET_SPECIALIZATION_MAP[withPrefix];
  }
  
  // Try without sub_ prefix
  const withoutPrefix = normalized.replace(/^sub_/, '');
  if (VET_SPECIALIZATION_MAP[withoutPrefix]) {
    return VET_SPECIALIZATION_MAP[withoutPrefix];
  }
  
  // Humanize fallback: "sub_some_specialty" → "Some Specialty"
  return normalized
    .replace(/^(sub_|prob_)/, '')
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Get the primary (first) specialization from a staff object
 * Uses fallback hierarchy: specializations array → specialization field → default
 * 
 * @param staff - Staff object with specialization data
 * @returns Primary specialization display name
 */
export function getPrimarySpecialization(staff: any): string {
  console.log(`[PRIMARY-SPEC] Getting primary specialization for staff: ${staff.fullName || staff.name || 'Unknown'}`);
  console.log(`[PRIMARY-SPEC] - specializations array: ${staff.specializations ? JSON.stringify(staff.specializations) : 'none'}`);
  console.log(`[PRIMARY-SPEC] - specialization field: ${staff.specialization || 'none'}`);
  
  // Priority 1: First item in specializations array (most common)
  if (staff.specializations && Array.isArray(staff.specializations) && staff.specializations.length > 0) {
    console.log(`[PRIMARY-SPEC] Using first item from specializations array: "${staff.specializations[0]}"`);
    const result = getSpecializationDisplayName(staff.specializations[0]);
    console.log(`[PRIMARY-SPEC] → Result: "${result}"`);
    return result;
  }
  
  // Priority 2: Single specialization field (legacy/fallback)
  if (staff.specialization && staff.specialization !== '') {
    console.log(`[PRIMARY-SPEC] Using specialization field: "${staff.specialization}"`);
    const result = getSpecializationDisplayName(staff.specialization);
    console.log(`[PRIMARY-SPEC] → Result: "${result}"`);
    return result;
  }
  
  // Priority 3: Check specialty field (alternate naming)
  if (staff.specialty && staff.specialty !== '') {
    console.log(`[PRIMARY-SPEC] Using specialty field: "${staff.specialty}"`);
    const result = getSpecializationDisplayName(staff.specialty);
    console.log(`[PRIMARY-SPEC] → Result: "${result}"`);
    return result;
  }
  
  // Priority 4: Default fallback
  console.log(`[PRIMARY-SPEC] No specialization found → returning "General Practitioner"`);
  return "General Practitioner";
}

/**
 * Get all specializations from a staff object as display names
 * 
 * @param staff - Staff object with specialization data
 * @returns Array of specialization display names
 */
export function getAllSpecializations(staff: any): string[] {
  // Check specializations array
  if (staff.specializations && Array.isArray(staff.specializations) && staff.specializations.length > 0) {
    return staff.specializations.map((spec: string) => getSpecializationDisplayName(spec));
  }
  
  // Check single specialization field
  if (staff.specialization && staff.specialization !== '') {
    return [getSpecializationDisplayName(staff.specialization)];
  }
  
  // Check specialty field
  if (staff.specialty && staff.specialty !== '') {
    return [getSpecializationDisplayName(staff.specialty)];
  }
  
  // Default
  return ["General Practitioner"];
}

/**
 * Format specializations for display (with limit and "more" indicator)
 * 
 * @param specializations - Array of specialization display names
 * @param maxDisplay - Maximum number to display before showing "+X more"
 * @returns Formatted string (e.g., "Cardiologist, Dentist +1 more")
 */
export function formatSpecializationsForDisplay(specializations: string[], maxDisplay: number = 2): string {
  if (!specializations || specializations.length === 0) {
    return "General Practitioner";
  }
  
  if (specializations.length <= maxDisplay) {
    return specializations.join(', ');
  }
  
  const displayed = specializations.slice(0, maxDisplay);
  const remaining = specializations.length - maxDisplay;
  return `${displayed.join(', ')} +${remaining} more`;
}
