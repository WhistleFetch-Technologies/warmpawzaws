/**
 * Vendor Utility Functions
 * Centralized utilities for vendor role handling, service styles, and common operations
 */

/**
 * Get vendor role ID from vendor data object
 * Handles all possible field names and formats
 */
export function getVendorRoleId(vendorData: any): string | null {
  if (!vendorData) return null;
  
  return vendorData.roleId || 
         vendorData.role_id || 
         vendorData.selected_role_id ||
         vendorData.roleId ||
         null;
}

/**
 * Get vendor role name from vendor data
 * Handles multiple data structures: roleName, role.name, role_name, etc.
 */
export function getVendorRoleName(vendorData: any): string | null {
  if (!vendorData) return null;
  
  // ✅ FIX: Check role.name first (most common structure from backend)
  if (vendorData.role?.name) {
    return vendorData.role.name;
  }
  
  return vendorData.roleName ||
         vendorData.role_name ||
         vendorData.displayRoleName ||
         null;
}

/**
 * Service Style Mapping
 * Maps various backend service style names to standardized frontend names
 */
const SERVICE_STYLE_MAP: Record<string, 'at_home' | 'at_center' | 'tele'> = {
  // Standard names
  'at_home': 'at_home',
  'at_center': 'at_center',
  'tele': 'tele',
  
  // Backend variations
  'at_clinic': 'at_center',
  'clinic': 'at_center',
  'video_consultation': 'tele',
  'tele_consultation': 'tele',
  'teleconsultation': 'tele',
  'online': 'tele',
  'home_visit': 'at_home',
  'home_service': 'at_home',
  'mobile': 'at_home',
};

/**
 * Normalize service style to standard format
 */
export function normalizeServiceStyle(style: string | null | undefined): 'at_home' | 'at_center' | 'tele' {
  if (!style) return 'at_center'; // Default
  
  const normalized = style.toLowerCase().trim();
  return SERVICE_STYLE_MAP[normalized] || 'at_center';
}

/**
 * Get display name for service style (generic).
 * For role-based labels (e.g. "Training center booking") use getServiceStyleLabel from @/lib/service-style-labels.
 */
export function getServiceStyleDisplayName(style: string): string {
  const normalized = normalizeServiceStyle(style);
  const displayNames: Record<string, string> = {
    'at_home': 'At Home',
    'at_center': 'At Center',
    'tele': 'Tele Consultation',
  };
  return displayNames[normalized] || style;
}

/**
 * Check if vendor has specific role
 */
export function hasVendorRole(
  vendorData: any, 
  roleIdOrName: string | string[]
): boolean {
  const roleId = getVendorRoleId(vendorData);
  const roleName = getVendorRoleName(vendorData);
  
  const rolesToCheck = Array.isArray(roleIdOrName) ? roleIdOrName : [roleIdOrName];
  
  return rolesToCheck.some(role => {
    const normalizedRole = role.toLowerCase().trim().replace(/\s+/g, '_');
    const vendorRoleNorm = normalizeRoleName(roleName || '');
    return (
      roleId?.toLowerCase() === normalizedRole ||
      roleName?.toLowerCase() === normalizedRole ||
      roleId?.includes(normalizedRole) ||
      roleName?.includes(normalizedRole) ||
      vendorRoleNorm === normalizedRole ||
      (vendorRoleNorm && normalizedRole.includes(vendorRoleNorm))
    );
  });
}

/**
 * Check if vendor is a specific role type
 */
export function isVendorType(
  vendorData: any,
  type: 'service' | 'healthcare' | 'retail' | 'boarding'
): boolean {
  const roleId = getVendorRoleId(vendorData);
  const roleName = getVendorRoleName(vendorData);
  
  const roleString = `${roleId} ${roleName}`.toLowerCase();
  
  const typeMap: Record<string, string[]> = {
    service: ['groomer', 'walker', 'trainer', 'sitter', 'service'],
    healthcare: ['vet', 'veterinarian', 'clinic', 'hospital', 'healthcare'],
    retail: ['store', 'pharmacy', 'seller', 'retail', 'products'],
    boarding: ['boarding', 'resort', 'kennel', 'hotel'],
  };
  
  const keywords = typeMap[type] || [];
  return keywords.some(keyword => roleString.includes(keyword));
}

/**
 * Normalize role name for matching
 */
export function normalizeRoleName(roleName: string | null | undefined): string {
  if (!roleName) return '';
  
  return roleName
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

/**
 * Check if vendor is a diagnostics center
 * Handles role name variations: diagnostics_center, diagnostic_center, etc.
 * Also checks capabilities as fallback if roleName is not available.
 */
export function isDiagnosticsCenter(vendorData: any): boolean {
  if (!vendorData) {
    console.log('🔍 [isDiagnosticsCenter] No vendorData provided');
    return false;
  }
  
  // ✅ FIX: Check role.name directly first (most common structure)
  const roleNameFromRole = vendorData.role?.name;
  const roleName = roleNameFromRole || getVendorRoleName(vendorData);
  const roleId = getVendorRoleId(vendorData);
  
  // Debug logging
  console.log('🔍 [isDiagnosticsCenter] Checking vendor:', {
    roleNameFromRole,
    roleName,
    roleId,
    hasRoleName: !!roleName,
    hasRoleId: !!roleId,
    roleObject: vendorData.role,
    vendorDataKeys: Object.keys(vendorData || {})
  });
  
  // Normalize role name
  const normalizedRoleName = normalizeRoleName(roleName || '');
  
  // Check for diagnostics center role patterns
  const diagnosticsCenterPatterns = [
    'diagnostics_center',
    'diagnostic_center',
    'diagnostics',
  ];
  
  // Check if role name matches any pattern
  const matchesRoleName = diagnosticsCenterPatterns.some(pattern => 
    normalizedRoleName === pattern || normalizedRoleName.includes(pattern)
  );
  
  // If roleId is a UUID, we can't check it directly, so rely on roleName
  // If roleId is not a UUID and contains diagnostics_center, check it too
  const isRoleIdUUID = roleId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(roleId);
  const matchesRoleId = !isRoleIdUUID && roleId && 
    diagnosticsCenterPatterns.some(pattern => 
      roleId.toLowerCase().includes(pattern)
    );
  
  // ✅ FIX: Also check capabilities as fallback
  // Check if vendor has diagnostic_results capability (indicates diagnostics center)
  const hasDiagnosticCapability = vendorData.capabilities?.some?.((cap: any) => 
    (typeof cap === 'string' && (cap === 'diagnostic_results' || cap === 'diagnostics' || cap === 'test_catalog')) ||
    (cap?.name && (cap.name === 'diagnostic_results' || cap.name === 'diagnostics' || cap.name === 'test_catalog'))
  ) || false;
  
  // ✅ FIX: Check vendorType or other indicators
  const vendorType = (vendorData.vendorType || vendorData.vendor_type || '').toLowerCase();
  const matchesVendorType = vendorType.includes('diagnostic') || vendorType.includes('diagnostics');
  
  const result = matchesRoleName || matchesRoleId || hasDiagnosticCapability || matchesVendorType;
  
  console.log('🔍 [isDiagnosticsCenter] Result:', {
    normalizedRoleName,
    matchesRoleName,
    matchesRoleId,
    hasDiagnosticCapability,
    matchesVendorType,
    finalResult: result
  });
  
  return result;
}

/**
 * Check if service is applicable to vendor role
 */
export function isServiceApplicableToRole(
  service: { applicableRoles?: string[] | string },
  vendorRoleName: string | null
): boolean {
  if (!vendorRoleName) return true; // Show all if no role
  
  const applicableRoles = service.applicableRoles || [];
  
  // If no roles specified, service is universal
  if (!applicableRoles || applicableRoles.length === 0) {
    return true;
  }
  
  // Normalize role name
  const normalizedVendorRole = normalizeRoleName(vendorRoleName);
  
  // Parse applicable roles (handle both array and string)
  let rolesArray: string[] = [];
  if (Array.isArray(applicableRoles)) {
    rolesArray = applicableRoles;
  } else if (typeof applicableRoles === 'string') {
    try {
      const parsed = JSON.parse(applicableRoles);
      rolesArray = Array.isArray(parsed) ? parsed : [applicableRoles];
    } catch {
      rolesArray = [applicableRoles];
    }
  }
  
  // Normalize all applicable roles
  const normalizedApplicableRoles = rolesArray
    .filter(Boolean)
    .map(r => normalizeRoleName(r));
  
  // Direct match
  if (normalizedApplicableRoles.includes(normalizedVendorRole)) {
    return true;
  }
  
  // Role name variations
  const roleVariations: Record<string, string[]> = {
    'veterinarian': ['vet', 'veterinary', 'veterinary_clinic', 'vet_clinic', 'animal_hospital', 'vet_solo', 'solo_vet'],
    'vet_solo': ['vet', 'veterinarian', 'veterinary', 'veterinary_clinic', 'vet_clinic', 'animal_hospital', 'solo_vet'],
    'pet_groomer': ['groomer', 'grooming', 'pet_grooming'],
    'pet_boarder': ['boarder', 'boarding', 'pet_boarding', 'kennel'],
    'pet_trainer': ['trainer', 'training', 'pet_training', 'dog_trainer'],
    'pet_walker': ['walker', 'walking', 'dog_walker', 'pet_walking'],
    'pet_sitter': ['sitter', 'sitting', 'pet_sitting'],
    'pet_pharmacy': ['pharmacy', 'pharmacist'],
    'pet_nutritionist': ['nutritionist', 'nutrition'],
    'pet_products_store': ['store', 'retailer', 'seller'],
  };
  
  // Check variations
  for (const [mainRole, variations] of Object.entries(roleVariations)) {
    if (normalizedVendorRole === mainRole || variations.includes(normalizedVendorRole)) {
      if (normalizedApplicableRoles.includes(mainRole) ||
          variations.some(v => normalizedApplicableRoles.includes(v))) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * ============================================================================
 * SOLO VENDOR DETECTION - SINGLE SOURCE OF TRUTH
 * ============================================================================
 * Use this function throughout the application to check if a vendor is a solo provider.
 * Solo providers have different capabilities and restrictions.
 */

/**
 * Check if vendor is a solo provider (individual practitioner without a business/center)
 * Solo providers have restricted capabilities:
 * - No at_center service style (they don't have a physical location)
 * - No staff management (they are the only provider)
 * - Different profile structure (professional profile vs center profile)
 * 
 * @param vendorData - Vendor data object from API or state
 * @returns true if vendor is a solo provider
 */
export function isSoloVendor(vendorData: any): boolean {
  if (!vendorData) return false;
  
  // Check explicit vendorConfiguration field (preferred method from backend)
  if (vendorData.vendorConfiguration === 'solo') return true;
  
  // Check various boolean flags
  if (vendorData.isSoloProvider === true) return true;
  if (vendorData.is_solo_provider === true) return true;
  if (vendorData.isIndividualProvider === true) return true;
  if (vendorData.is_individual_provider === true) return true;
  
  // Check vendor_type field
  if (vendorData.vendor_type === 'solo') return true;
  if (vendorData.vendorType === 'solo') return true;
  if (vendorData.vendor_type === 'individual') return true;
  if (vendorData.vendorType === 'individual') return true;
  
  // Check role name patterns (some roles are inherently solo)
  // ✅ CRITICAL: Check role.name first (most common structure from backend)
  const roleName = vendorData?.role?.name || getVendorRoleName(vendorData) || '';
  const roleId = getVendorRoleId(vendorData) || '';
  const roleNameLower = roleName.toLowerCase();
  const roleIdLower = roleId.toLowerCase();
  const roleString = `${roleNameLower} ${roleIdLower}`;
  
  const soloRolePatterns = [
    '_solo',
    'solo_',
    'individual',
    'freelance',
    'independent',
  ];
  
  if (soloRolePatterns.some(pattern => roleString.includes(pattern))) {
    return true;
  }
  
  return false;
}

/**
 * Get the allowed service styles for a vendor based on their configuration
 * Solo vendors cannot have at_center style
 * 
 * @param vendorData - Vendor data object
 * @returns Array of allowed service style strings
 */
export function getVendorAllowedServiceStyles(vendorData: any): ('at_center' | 'at_home' | 'tele')[] {
  // Get base allowed styles from vendor data
  const baseStyles = vendorData?.allowedServiceStyles || 
                     vendorData?.serviceStyles || 
                     vendorData?.selectedServiceStyles || 
                     ['at_center', 'at_home', 'tele'];
  
  // Filter to valid styles
  const validStyles = baseStyles.filter((style: string) => 
    ['at_center', 'at_home', 'tele'].includes(style)
  ) as ('at_center' | 'at_home' | 'tele')[];
  
  // Solo vendors cannot have at_center
  if (isSoloVendor(vendorData)) {
    return validStyles.filter(style => style !== 'at_center');
  }
  
  return validStyles;
}

/**
 * Check if vendor can use a specific service style
 * 
 * @param vendorData - Vendor data object
 * @param style - Service style to check
 * @returns true if vendor can use this style
 */
export function canVendorUseServiceStyle(vendorData: any, style: 'at_center' | 'at_home' | 'tele'): boolean {
  const allowedStyles = getVendorAllowedServiceStyles(vendorData);
  return allowedStyles.includes(style);
}
