/**
 * ROLE ID NORMALIZER
 * Utility functions for normalizing and matching role IDs
 * Handles variations like 'role_veterinarian' vs 'veterinarian'
 */

/**
 * Normalize role ID to handle variations
 * Handles both 'role_veterinarian' and 'veterinarian' formats
 */
export function normalizeRoleId(roleId: string): string {
  if (!roleId) return roleId;
  
  // If already has 'role_' prefix, return as-is
  if (roleId.startsWith('role_')) {
    return roleId;
  }
  
  // Add 'role_' prefix if missing
  return `role_${roleId}`;
}

/**
 * Build a comprehensive set of applicable roles including variations
 * Extracts roles from matching services and normalizes them
 */
export function buildApplicableRolesSet(matchingServices: any[]): Set<string> {
  const rolesSet = new Set<string>();
  
  if (!matchingServices || !Array.isArray(matchingServices)) {
    return rolesSet;
  }
  
  for (const service of matchingServices) {
    // Check various possible fields for role information
    const roleId = service.roleId || service.role_id || service.role || service.applicableRole;
    
    if (roleId) {
      // Add normalized version
      const normalized = normalizeRoleId(roleId);
      rolesSet.add(normalized);
      
      // Also add original if different (for backward compatibility)
      if (normalized !== roleId) {
        rolesSet.add(roleId);
      }
    }
    
    // Check if service has applicableRoles array
    if (service.applicableRoles && Array.isArray(service.applicableRoles)) {
      for (const role of service.applicableRoles) {
        const normalized = normalizeRoleId(role);
        rolesSet.add(normalized);
        if (normalized !== role) {
          rolesSet.add(role);
        }
      }
    }
  }
  
  return rolesSet;
}

/**
 * Check if a vendor's role matches any of the applicable roles
 */
export function vendorRoleMatchesApplicableRoles(
  vendorRoleId: string,
  applicableRoles: Set<string>
): boolean {
  if (!vendorRoleId || !applicableRoles || applicableRoles.size === 0) {
    return false;
  }
  
  const normalizedVendorRole = normalizeRoleId(vendorRoleId);
  
  // Check if normalized role matches
  if (applicableRoles.has(normalizedVendorRole)) {
    return true;
  }
  
  // Check if original role matches
  if (applicableRoles.has(vendorRoleId)) {
    return true;
  }
  
  // Check reverse normalization (if applicable roles have 'role_' prefix)
  const roleWithoutPrefix = vendorRoleId.replace(/^role_/, '');
  if (applicableRoles.has(roleWithoutPrefix)) {
    return true;
  }
  
  return false;
}

/**
 * Filter vendors by role
 * Returns vendors whose role matches any of the applicable roles
 */
export function filterVendorsByRole(
  vendors: any[],
  applicableRoles: Set<string>
): any[] {
  if (!vendors || !Array.isArray(vendors) || applicableRoles.size === 0) {
    return [];
  }
  
  return vendors.filter(vendor => {
    const vendorRoleId = vendor.roleId || vendor.role_id || vendor.role;
    return vendorRoleMatchesApplicableRoles(vendorRoleId, applicableRoles);
  });
}

