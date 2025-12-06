/**
 * 🔧 UNIVERSAL ROLE ID NORMALIZER
 * 
 * Handles all role ID variations across the platform:
 * - Vendor roleIds: pet_groomer, pet_clinic, pet_trainer, etc.
 * - Service applicableRoles: groomer, role_groomer, veterinarian, role_veterinarian, etc.
 * - Discovery roleIds: veterinarian, groomer, trainer, dog_walker, behaviourist, boarding
 * 
 * This module provides ONE canonical mapping to ensure seamless matching.
 */

/**
 * Canonical role families - each role can have multiple variations
 */
export const ROLE_FAMILIES = {
  veterinarian: [
    'veterinarian',
    'role_veterinarian',
    'vet',
    'role_vet',
    'vet_clinic',
    'role_vet_clinic',
    'pet_clinic',
    'role_pet_clinic',
    'veterinary_clinic',
    'role_veterinary_clinic',
  ],
  groomer: [
    'groomer',
    'role_groomer',
    'pet_groomer',
    'role_pet_groomer',
    'grooming_center',
    'role_grooming_center',
    'pet_grooming',
    'role_pet_grooming',
  ],
  trainer: [
    'trainer',
    'role_trainer',
    'pet_trainer',
    'role_pet_trainer',
    'training_center',
    'role_training_center',
    'dog_trainer',
    'role_dog_trainer',
  ],
  dog_walker: [
    'dog_walker',
    'role_dog_walker',
    'pet_walker',
    'role_pet_walker',
    'walker',
    'role_walker',
    'walking_service',
    'role_walking_service',
  ],
  behaviourist: [
    'behaviourist',
    'role_behaviourist',
    'behaviorist',
    'role_behaviorist',
    'pet_behaviorist',
    'role_pet_behaviorist',
    'behavioral_specialist',
    'role_behavioral_specialist',
  ],
  boarding: [
    'boarding',
    'role_boarding',
    'pet_boarding',
    'role_pet_boarding',
    'boarding_center',
    'role_boarding_center',
    'kennel',
    'role_kennel',
  ],
};

/**
 * Reverse mapping: any variation → canonical role
 */
const VARIATION_TO_CANONICAL: Map<string, string> = new Map();
Object.entries(ROLE_FAMILIES).forEach(([canonical, variations]) => {
  variations.forEach(variation => {
    VARIATION_TO_CANONICAL.set(variation.toLowerCase(), canonical);
  });
});

/**
 * Normalize any role ID variation to its canonical form
 * @param roleId - Any role ID variation
 * @returns Canonical role ID (veterinarian, groomer, trainer, etc.)
 */
export function normalizeRoleId(roleId: string | undefined | null): string | null {
  if (!roleId) return null;
  
  const normalized = roleId.toLowerCase().trim();
  
  // Check direct mapping
  if (VARIATION_TO_CANONICAL.has(normalized)) {
    return VARIATION_TO_CANONICAL.get(normalized)!;
  }
  
  // Try removing 'role_' prefix
  if (normalized.startsWith('role_')) {
    const withoutPrefix = normalized.replace('role_', '');
    if (VARIATION_TO_CANONICAL.has(withoutPrefix)) {
      return VARIATION_TO_CANONICAL.get(withoutPrefix)!;
    }
  }
  
  // Try adding 'role_' prefix
  const withPrefix = `role_${normalized}`;
  if (VARIATION_TO_CANONICAL.has(withPrefix)) {
    return VARIATION_TO_CANONICAL.get(withPrefix)!;
  }
  
  // Return as-is if no mapping found
  return roleId;
}

/**
 * Check if two role IDs are equivalent (belong to same family)
 * @param roleId1 - First role ID
 * @param roleId2 - Second role ID
 * @returns true if roles belong to the same family
 */
export function rolesMatch(roleId1: string | undefined | null, roleId2: string | undefined | null): boolean {
  if (!roleId1 || !roleId2) return false;
  
  const canonical1 = normalizeRoleId(roleId1);
  const canonical2 = normalizeRoleId(roleId2);
  
  return canonical1 === canonical2;
}

/**
 * Check if a vendor's role matches any of the applicable roles from services
 * @param vendorRoleId - Vendor's roleId (e.g., 'pet_groomer')
 * @param applicableRoles - Set of applicable roles from services (e.g., Set(['groomer', 'role_groomer']))
 * @returns true if vendor role matches any applicable role
 */
export function vendorRoleMatchesApplicableRoles(
  vendorRoleId: string | undefined | null,
  applicableRoles: Set<string>
): boolean {
  if (!vendorRoleId) return false;
  
  const vendorCanonical = normalizeRoleId(vendorRoleId);
  if (!vendorCanonical) return false;
  
  // Check if any applicable role matches the vendor's canonical role
  for (const applicableRole of applicableRoles) {
    const applicableCanonical = normalizeRoleId(applicableRole);
    if (applicableCanonical === vendorCanonical) {
      return true;
    }
  }
  
  return false;
}

/**
 * Build a comprehensive set of all role variations for matching
 * Expands applicableRoles to include all variations from the role families
 * @param applicableRoles - Original applicable roles from services
 * @returns Expanded set including all variations
 */
export function expandApplicableRoles(applicableRoles: string[]): Set<string> {
  const expanded = new Set<string>();
  
  applicableRoles.forEach(role => {
    const canonical = normalizeRoleId(role);
    if (canonical && ROLE_FAMILIES[canonical as keyof typeof ROLE_FAMILIES]) {
      // Add all variations for this role family
      ROLE_FAMILIES[canonical as keyof typeof ROLE_FAMILIES].forEach(variation => {
        expanded.add(variation);
        expanded.add(variation.toLowerCase());
      });
    } else {
      // Add the original role even if not in our mapping
      expanded.add(role);
      expanded.add(role.toLowerCase());
    }
  });
  
  return expanded;
}

/**
 * Get all role variations for a canonical role
 * @param canonicalRole - Canonical role name (veterinarian, groomer, etc.)
 * @returns Array of all role variations
 */
export function getRoleVariations(canonicalRole: string): string[] {
  const normalized = canonicalRole.toLowerCase();
  return ROLE_FAMILIES[normalized as keyof typeof ROLE_FAMILIES] || [canonicalRole];
}

/**
 * Build applicable roles set from matching services
 * Normalizes and expands roles to match vendor roleIds
 * @param matchingServices - Services that match the problem
 * @returns Set of all applicable roles and their variations
 */
export function buildApplicableRolesSet(matchingServices: any[]): Set<string> {
  const allApplicableRoles: string[] = [];
  
  matchingServices.forEach((service: any) => {
    if (service.applicableRoles && Array.isArray(service.applicableRoles)) {
      allApplicableRoles.push(...service.applicableRoles);
    }
    // Also check legacy roleId field
    if (service.roleId) {
      allApplicableRoles.push(service.roleId);
    }
  });
  
  // Expand to include all variations
  return expandApplicableRoles(allApplicableRoles);
}

/**
 * Filter vendors by matching their roleId against applicable roles
 * @param vendors - All vendors to filter
 * @param applicableRoles - Set of applicable roles (already expanded)
 * @param requireApproved - Whether to require approved status
 * @param requireActive - Whether to require active status
 * @returns Filtered vendors that match the role criteria
 */
export function filterVendorsByRole(
  vendors: any[],
  applicableRoles: Set<string>,
  requireApproved: boolean = true,
  requireActive: boolean = true
): any[] {
  return vendors.filter((vendor: any) => {
    // Check approval status
    if (requireApproved && vendor.status !== 'approved') {
      return false;
    }
    
    // Check active status
    if (requireActive && vendor.isActive === false) {
      return false;
    }
    
    // Check role match using canonical normalization
    return vendorRoleMatchesApplicableRoles(vendor.roleId, applicableRoles);
  });
}

/**
 * Debug helper: Log role matching details
 */
export function debugRoleMatching(vendorRoleId: string, applicableRoles: Set<string>): void {
  console.log(`\n🔍 [ROLE MATCHING DEBUG]`);
  console.log(`   Vendor roleId: "${vendorRoleId}"`);
  console.log(`   Vendor canonical: "${normalizeRoleId(vendorRoleId)}"`);
  console.log(`   Applicable roles:`, Array.from(applicableRoles));
  console.log(`   Applicable canonicals:`, Array.from(applicableRoles).map(r => normalizeRoleId(r)));
  console.log(`   Match result: ${vendorRoleMatchesApplicableRoles(vendorRoleId, applicableRoles)}`);
}
