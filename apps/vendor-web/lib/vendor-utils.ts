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
 * Pill label for vendor booking details (next to status): Home Service | Clinic Visit | Tele.
 * Prefers explicit style fields; only treats `serviceType` as a style when it looks like one
 * (so e.g. vet_care does not become a venue label).
 */
export function getVendorBookingVenuePillLabel(bookingLike: {
  serviceStyle?: string | null;
  service_style?: string | null;
  serviceType?: string | null;
  communicationType?: string | null;
  service?: { service_style?: string; serviceStyle?: string } | null;
}): string {
  if (String(bookingLike.communicationType || '').toLowerCase() === 'video') {
    return 'Tele';
  }

  let raw = String(
    bookingLike.serviceStyle ||
      bookingLike.service_style ||
      bookingLike.service?.service_style ||
      bookingLike.service?.serviceStyle ||
      ''
  ).trim();

  if (!raw) {
    const st = String(bookingLike.serviceType || '').toLowerCase().trim();
    const looksLikeStyle =
      [
        'tele',
        'video_consultation',
        'at_home',
        'at_center',
        'at_clinic',
        'at_vendor',
        'clinic',
        'home_visit',
        'home_service',
        'hybrid',
        'online',
      ].includes(st) ||
      st.includes('tele') ||
      st.includes('video');
    if (looksLikeStyle) raw = st;
  }

  const norm = normalizeServiceStyle(raw || undefined);
  if (norm === 'tele') return 'Tele';
  if (norm === 'at_home') return 'Home Service';
  return 'Clinic Visit';
}

/** Tele / video consultation — used for OTP skip and POST /vendor/bookings/:id/complete. */
export function isVendorTeleConsultationBooking(bookingLike: {
  serviceType?: string | null;
  service_type?: string | null;
  service_style?: string | null;
  serviceStyle?: string | null;
  communicationType?: string | null;
}): boolean {
  if (String(bookingLike.communicationType || '').toLowerCase() === 'video') {
    return true;
  }
  const st = String(
    bookingLike.serviceType ||
      bookingLike.service_type ||
      bookingLike.service_style ||
      bookingLike.serviceStyle ||
      ''
  )
    .toLowerCase()
    .trim();
  return (
    st === 'tele' ||
    st === 'video_consultation' ||
    st === 'tele_consultation' ||
    st === 'teleconsultation' ||
    st.includes('tele')
  );
}

export function resolveVendorBookingId(bookingLike: {
  id?: string | null;
  bookingId?: string | null;
}): string {
  return String(bookingLike.bookingId || bookingLike.id || '').trim();
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

/** True for dog/pet walker roles (booking-derived walk progress + live session tracking). */
export function isVendorWalkerProgramProgress(vendorData: any): boolean {
  return hasVendorRole(vendorData, ['pet_walker', 'walker', 'dog_walker']);
}

/** `ProgressTrackingDashboard` role → program-type inference (training vs behavioral vs nutrition vs walking). */
export type VendorProgressRoleType = 'trainer' | 'behaviorist' | 'nutritionist' | 'walker';

/**
 * Maps vendor role to program progress UI (`ProgressTrackingDashboard` `roleType`).
 * Walkers use `/bookings?walkSessions=1` + `/bookings/home-service?bookingId=` for live sessions, not training progress.
 */
export function getVendorProgressRoleType(vendorData: any): VendorProgressRoleType {
  if (isVendorWalkerProgramProgress(vendorData)) {
    return 'walker';
  }
  if (hasVendorRole(vendorData, ['nutritionist', 'pet_nutritionist', 'nutritionist_center'])) {
    return 'nutritionist';
  }
  if (
    hasVendorRole(vendorData, [
      'pet_behaviorist',
      'behaviorist_solo',
      'behaviorist_center',
      'behaviorist',
    ])
  ) {
    return 'behaviorist';
  }
  return 'trainer';
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
 * Check if a role name/ID indicates a center (clinic, salon, facility) rather than solo.
 * Used to show Amenities and Specialization tabs for center profiles even when
 * vendorType/vendorConfiguration is incorrectly or missing (e.g. returned as 'solo').
 *
 * @param roleNameOrId - Role name (e.g. 'veterinary_clinic') or role ID string
 * @returns true if the role is a center type
 */
export function isCenterRole(roleNameOrId: string | null | undefined): boolean {
  if (!roleNameOrId || typeof roleNameOrId !== 'string') return false;
  const n = roleNameOrId.toLowerCase().trim();
  if (!n) return false;
  // Roles that have a physical center: *_center, *_clinic (e.g. veterinary_clinic, groomer_center)
  return n.includes('_center') || n.includes('_clinic');
}

/**
 * Raw style strings from vendor profile / dashboard (Admin role → vendor.allowedServiceStyles, etc.).
 * Does not invent defaults — empty means caller should treat as "no styles declared".
 */
function rawStyleIdsFromVendorData(vendorData: any): string[] {
  if (!vendorData) return [];
  const a = vendorData.allowedServiceStyles ?? vendorData.allowed_service_styles;
  if (Array.isArray(a) && a.length) return a.map((x: unknown) => String(x));
  const sel = vendorData.selectedServiceStyles ?? vendorData.selected_service_styles;
  if (Array.isArray(sel) && sel.length) return sel.map((x: unknown) => String(x));
  const ss = vendorData.serviceStyles ?? vendorData.service_styles;
  if (Array.isArray(ss) && ss.length) return ss.map((x: unknown) => String(x));
  if (ss && typeof ss === 'object' && !Array.isArray(ss)) {
    const nested =
      (ss as any).selected ?? (ss as any).solo ?? (ss as any).business;
    if (Array.isArray(nested) && nested.length) {
      return nested.map((x: unknown) => String(x));
    }
  }
  return [];
}

/**
 * Vendor-web product rule (no backend change): behaviorist_center & behaviorist_solo do not use
 * the tele service bucket ("Online Behavior Consultation") in UI — hide tele tabs, filters, and service mgmt cards.
 */
export function filterTeleForBehavioristCenterSoloVendorWeb<T extends string>(
  vendorData: any,
  styles: readonly T[]
): T[] {
  if (!hasVendorRole(vendorData, ['behaviorist_center', 'behaviorist_solo'])) {
    return [...styles];
  }
  return styles.filter((s) => String(s).toLowerCase() !== 'tele');
}

/**
 * Allowed service styles from Admin role / vendor profile (canonical at_center | at_home | tele).
 * Solo vendors cannot have at_center. Returns [] when the API omitted style lists (strict callers use []).
 */
export function getVendorAllowedServiceStyles(vendorData: any): ('at_center' | 'at_home' | 'tele')[] {
  const raw = rawStyleIdsFromVendorData(vendorData).map((s) => s.toLowerCase().trim());
  const out = new Set<'at_center' | 'at_home' | 'tele'>();
  for (const s of raw) {
    if (['at_center', 'at_vendor', 'at_clinic', 'center', 'clinic'].includes(s)) {
      out.add('at_center');
    } else if (['at_home', 'home_visit', 'home', 'at_home_visit'].includes(s)) {
      out.add('at_home');
    } else if (['tele', 'online', 'video_consultation', 'video', 'remote'].includes(s)) {
      out.add('tele');
    }
  }
  let arr = Array.from(out);
  if (isSoloVendor(vendorData)) {
    arr = arr.filter((style) => style !== 'at_center');
  }
  return filterTeleForBehavioristCenterSoloVendorWeb(vendorData, arr);
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
