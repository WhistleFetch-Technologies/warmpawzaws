/**
 * PROBLEM GRID TO SUBCATEGORY NAME MAPPING
 * Maps problem grid subcategory IDs to their actual names in the service catalog
 * This ensures proper matching between customer problems and vendor services
 * 
 * NOTE: We support MULTIPLE name variations because:
 * - Comprehensive catalog uses: "Healthcare Service Providers"
 * - Legacy seed data uses: "Veterinary Services"
 * - Subcategories can have variations too
 */

/**
 * Subcategory ID to Name mapping
 * Each ID can map to MULTIPLE possible names (for backward compatibility)
 */
export const subcategoryIdToNames: Record<string, string[]> = {
  // ============================================
  // VETERINARY SUBCATEGORIES
  // ============================================
  'sub_preventive_wellness': [
    'Preventive & Wellness Care',
    '1. Preventive & Wellness Care',  // Legacy numbered version
    'Consultation & Checkup',  // Legacy
    'Consultation',            // 🇮🇳 India catalog
    'Vaccination',             // 🇮🇳 India catalog
    'Deworming',               // 🇮🇳 India catalog
    'Preventive Care'          // Variation
  ],
  'sub_diagnostics': [
    'Diagnostics',
    '2. Diagnostics',          // Legacy numbered version
    'Diagnostic Services',
    'Laboratory Services',     // 🇮🇳 India catalog
    'Lab Tests',               // Variation
    'Diagnostic Tests'         // Variation
  ],
  'sub_medical_treatment': [
    'Medical Treatment (Non-Surgical)',
    '3. Medical Treatment (Non-Surgical)',  // Legacy numbered version
    'Medical Treatment',
    'Surgery & Procedures',    // Can overlap
    'Post-Operative Care',     // 🇮🇳 India catalog
    'Treatment',               // Variation
    'Medical Care'             // Variation
  ],
  'sub_surgical_services': [
    'Surgical Services',
    '4. Surgical Services',    // Legacy numbered version
    'Surgery & Procedures',
    'Surgery',                 // 🇮🇳 India catalog
    'Surgical Procedures',     // Variation
    'Operations'               // Variation
  ],
  'sub_specialty_services': [
    'Specialty Vet Services',
    '5. Specialty Vet Services',  // Legacy numbered version
    'Specialty Services',
    'Specialized Care',        // Variation
    'Advanced Care',           // Variation
    'Heart & Cardiovascular',  // Cardiology
    'Cardiology',              // Cardiology
    'Dermatology',             // Skin care
    'Skin & Coat Care',        // Dermatology
    'Dental Care',             // Dentistry
    'Dentistry',               // Dentistry
    'Eye Care',                // Ophthalmology
    'Ophthalmology',           // Ophthalmology
    'Neurological Care',       // Neurology
    'Neurology',               // Neurology
    'Physical Therapy',        // Physiotherapy
    'Physiotherapy'            // Physiotherapy
  ],
  'sub_emergency_critical': [
    'Emergency & Critical Care',
    '6. Emergency & Critical Care',  // Legacy numbered version
    'Emergency Care',
    'Emergency Services',      // Variation
    'Critical Care',           // Variation
    'ICU Services'             // Variation
  ],
  'sub_vet_home': [
    'Vet at Home Services',
    '7. Vet at Home Services', // Legacy numbered version
    'Home Visit Services',
    'At Home Consultation',
    'Home Visits',             // Variation
    'Mobile Vet Services'      // Variation
  ],
  'sub_teleconsult': [
    'Tele-Consultation Services',
    '8. Tele-Consultation Services',  // Legacy numbered version
    'Teleconsultation',
    'Tele Consultation',
    'Online Consultation',     // Variation
    'Virtual Consultation',    // Variation
    'Tele'                     // Short form
  ],
  'sub_health_programs': [
    'Health Programs & Packages',
    '9. Health Programs & Packages',  // Legacy numbered version
    'Wellness Programs',
    'Vaccination',             // Common program (overlap with preventive)
    'Health Packages',         // Variation
    'Wellness Packages'        // Variation
  ],
  'sub_documents_cert': [
    'Documents & Certification',
    '10. Documents & Certification',  // Legacy numbered version
    'Pet Certification',
    'Health Certificates',
    'Certificates',            // Variation
    'Documentation'            // Variation
  ],
  
  // ============================================
  // GROOMING SUBCATEGORIES
  // ============================================
  'sub_grooming_basic': [
    'Basic Grooming Services',
    '1. Basic Grooming Services',  // Legacy numbered version
    'Basic Grooming'
  ],
  'sub_grooming_specialty': [
    'Specialty Grooming',
    '2. Specialty Grooming',   // Legacy numbered version
    'Advanced Grooming'
  ],
  'sub_grooming_mobile': [
    'Mobile Grooming',
    '3. Mobile Grooming',      // Legacy numbered version
    'Mobile Grooming Services'
  ],
  'sub_daycare': [
    'Daycare Services',
    '4. Daycare Services',     // Legacy numbered version
    'Day Care',
    'Pet Daycare'
  ],
  
  // ============================================
  // TRAINING SUBCATEGORIES
  // ============================================
  'sub_training_basic': [
    'Basic Obedience Training',
    '1. Basic Obedience Training',  // Legacy numbered version
    'Basic Training',
    'Obedience Training'
  ],
  'sub_training_advanced': [
    'Advanced Training',
    '2. Advanced Training',    // Legacy numbered version
    'Advanced Obedience'
  ],
  'sub_behavior': [
    'Behavior Modification',
    '3. Behavior Modification',  // Legacy numbered version
    'Behavioral Training',
    'Behavior Consultation'
  ],
  'sub_training_private': [
    'Private Training Sessions',
    '4. Private Training Sessions',  // Legacy numbered version
    'Private Training',
    '1-on-1 Training'
  ],
  
  // ============================================
  // WALKING & SITTING SUBCATEGORIES
  // ============================================
  'sub_walking': [
    'Dog Walking',
    '1. Dog Walking',          // Legacy numbered version
    'Pet Walking',
    'Walking Services'
  ],
  'sub_sitting': [
    'Pet Sitting',
    '2. Pet Sitting',          // Legacy numbered version
    'Pet Boarding',
    'Home Sitting'
  ],
};

// Legacy single-name mapping for backward compatibility
export const subcategoryIdToName: Record<string, string> = Object.entries(subcategoryIdToNames)
  .reduce((acc, [id, names]) => {
    acc[id] = names[0]; // Use first name as primary
    return acc;
  }, {} as Record<string, string>);

/**
 * Reverse mapping: Name to ID
 */
export const subcategoryNameToId: Record<string, string> = Object.entries(subcategoryIdToName)
  .reduce((acc, [id, name]) => {
    acc[name] = id;
    // Also add lowercase version for flexible matching
    acc[name.toLowerCase()] = id;
    return acc;
  }, {} as Record<string, string>);

/**
 * Get subcategory names from IDs
 */
export function getSubcategoryNames(ids: string[]): string[] {
  return ids
    .map(id => subcategoryIdToName[id])
    .filter(name => name !== undefined);
}

/**
 * Get subcategory IDs from names
 */
export function getSubcategoryIds(names: string[]): string[] {
  return names
    .map(name => subcategoryNameToId[name] || subcategoryNameToId[name.toLowerCase()])
    .filter(id => id !== undefined);
}

/**
 * Get subcategory ID from a single name
 * Checks all name variations to find matching ID
 */
export function getSubcategoryIdByName(name: string): string | null {
  if (!name) return null;
  
  // Check direct mapping first
  const directMatch = subcategoryNameToId[name] || subcategoryNameToId[name.toLowerCase()];
  if (directMatch) return directMatch;
  
  // Check all variations
  const nameLower = name.toLowerCase();
  for (const [id, names] of Object.entries(subcategoryIdToNames)) {
    if (names.some(n => n.toLowerCase() === nameLower)) {
      return id;
    }
  }
  
  return null;
}

/**
 * Check if a service's subcategory matches any of the problem's subcategories
 * NOW supports multiple name variations for backward compatibility
 */
export function serviceMatchesSubcategories(
  service: any,
  problemSubcategoryIds: string[],
  enableDebugLogging = false
): boolean {
  const serviceSubcategoryName = service.subCategoryName;
  if (!serviceSubcategoryName) {
    if (enableDebugLogging) {
      console.log(`   ❌ Service "${service.serviceName}" has NO subCategoryName`);
    }
    return false;
  }
  
  // Build a list of ALL possible target names from problem subcategory IDs
  const allTargetNames: string[] = [];
  problemSubcategoryIds.forEach(subCatId => {
    const possibleNames = subcategoryIdToNames[subCatId] || [];
    allTargetNames.push(...possibleNames);
  });
  
  // Also add primary names from legacy mapping
  const legacyNames = getSubcategoryNames(problemSubcategoryIds);
  allTargetNames.push(...legacyNames);
  
  // Remove duplicates
  const uniqueTargetNames = Array.from(new Set(allTargetNames));
  
  // Check exact match (case-insensitive)
  const lowerServiceName = serviceSubcategoryName.toLowerCase().trim();
  
  if (enableDebugLogging) {
    console.log(`   🔍 Checking service "${service.serviceName}"`);
    console.log(`      Service subCategoryName: "${serviceSubcategoryName}" → cleaned: "${lowerServiceName}"`);
    console.log(`      Checking against ${uniqueTargetNames.length} variations:`, uniqueTargetNames);
  }
  
  for (const targetName of uniqueTargetNames) {
    const lowerTargetName = targetName.toLowerCase().trim();
    
    // Exact match
    if (lowerServiceName === lowerTargetName) {
      if (enableDebugLogging) {
        console.log(`      ✅ EXACT MATCH: "${serviceSubcategoryName}" === "${targetName}"`);
      }
      return true;
    }
    
    // Partial match (for cases like "1. Preventive Care" matching "Preventive Care")
    // Remove number prefix if present
    const cleanServiceName = lowerServiceName.replace(/^\d+\.\s*/, '');
    const cleanTargetName = lowerTargetName.replace(/^\d+\.\s*/, '');
    
    if (cleanServiceName === cleanTargetName) {
      if (enableDebugLogging) {
        console.log(`      ✅ PARTIAL MATCH (no prefix): "${cleanServiceName}" === "${cleanTargetName}"`);
      }
      return true;
    }
  }
  
  if (enableDebugLogging) {
    console.log(`      ❌ NO MATCH for "${serviceSubcategoryName}"`);
  }
  
  return false;
}

/**
 * Get all subcategories for a specific vendor type
 */
export function getSubcategoriesForVendorType(roleId: string): string[] {
  // Map role IDs to their subcategories
  const roleSubcategories: Record<string, string[]> = {
    // Veterinary
    'veterinarian': [
      'sub_preventive_wellness', 'sub_diagnostics', 'sub_medical_treatment',
      'sub_surgical_services', 'sub_specialty_services', 'sub_emergency_critical',
      'sub_vet_home', 'sub_teleconsult', 'sub_health_programs', 'sub_documents_cert'
    ],
    'vet_clinic': [
      'sub_preventive_wellness', 'sub_diagnostics', 'sub_medical_treatment',
      'sub_surgical_services', 'sub_specialty_services', 'sub_emergency_critical',
      'sub_vet_home', 'sub_teleconsult', 'sub_health_programs', 'sub_documents_cert'
    ],
    'pet_clinic': [
      'sub_preventive_wellness', 'sub_diagnostics', 'sub_medical_treatment',
      'sub_surgical_services', 'sub_specialty_services', 'sub_emergency_critical',
      'sub_vet_home', 'sub_teleconsult', 'sub_health_programs', 'sub_documents_cert'
    ],
    
    // Grooming
    'groomer': ['sub_grooming_basic', 'sub_grooming_specialty', 'sub_grooming_mobile', 'sub_daycare'],
    'pet_groomer': ['sub_grooming_basic', 'sub_grooming_specialty', 'sub_grooming_mobile', 'sub_daycare'],
    'grooming_center': ['sub_grooming_basic', 'sub_grooming_specialty', 'sub_grooming_mobile', 'sub_daycare'],
    
    // Training
    'trainer': ['sub_training_basic', 'sub_training_advanced', 'sub_behavior', 'sub_training_private'],
    'pet_trainer': ['sub_training_basic', 'sub_training_advanced', 'sub_behavior', 'sub_training_private'],
    'training_center': ['sub_training_basic', 'sub_training_advanced', 'sub_behavior', 'sub_training_private'],
    
    // Walking
    'dog_walker': ['sub_walking', 'sub_sitting'],
    'pet_walker': ['sub_walking', 'sub_sitting'],
    
    // Behavioral
    'behaviourist': ['sub_behavior'],
    'behaviorist': ['sub_behavior'],
    'pet_behaviorist': ['sub_behavior'],
    
    // Boarding
    'boarding': ['sub_daycare'],
    'pet_boarding': ['sub_daycare'],
    'boarding_center': ['sub_daycare'],
  };
  
  // Handle role_ prefix
  const cleanRoleId = roleId.replace('role_', '');
  return roleSubcategories[roleId] || roleSubcategories[cleanRoleId] || [];
}