/**
 * ============================================================================
 * CAPABILITY FILTERING - TWO-STAGE IMPLEMENTATION
 * ============================================================================
 * Stage 1: Solo/Business filtering
 * Stage 2: Service style filtering
 * ============================================================================
 * Purpose: Filter vendor capabilities based on vendorConfiguration and serviceStyles
 * Part of: Role Consolidation & Three-Level Enforcement
 * ============================================================================
 */

export interface CapabilityFilterOptions {
  vendorConfiguration: 'solo' | 'business';
  selectedServiceStyles: string[];
  baseCapabilities: string[];
  capabilityRules?: {
    solo?: {
      deniedCapabilities?: string[];
      allowedCapabilities?: string[];
    };
    business?: {
      deniedCapabilities?: string[];
    };
    serviceStyleDependencies?: {
      [style: string]: string[];
    };
  };
}

// Service style to capability mapping (default dependencies)
export const SERVICE_STYLE_CAPABILITIES: Record<string, string[]> = {
  'at_center': [
    'cafe_tables',
    'table_management',
    'rooms',
    'room_management',
    'facility_management',
    'cctv_access'
  ],
  'at_home': [
    'gps_tracking',
    'live_location',
    'distance_pricing'
  ],
  'tele': [
    'tele',
    'video_calling'
  ],
  'delivery': [
    'delivery',
    'delivery_partner',
    'eta_tracking'
  ]
};

/**
 * Stage 1: Filter capabilities by vendorConfiguration (solo/business)
 * - Solo: Remove staff_management, inventory_manage, custom_services, center_profile
 * - Solo: Add platform_catalog_services, professional_profile
 */
export function filterCapabilitiesByVendorConfiguration(
  options: CapabilityFilterOptions
): string[] {
  const { vendorConfiguration, baseCapabilities, capabilityRules } = options;
  
  let filtered = [...baseCapabilities];
  
  if (vendorConfiguration === 'solo') {
    const soloRules = capabilityRules?.solo;
    const deniedForSolo = soloRules?.deniedCapabilities || [
      'staff_management', 'staff_create', 'staff_schedule',
      'inventory_manage', 'inventory',
      'custom_services', 'custom_packages',
      'center_profile'
    ];
    
    // Remove denied capabilities
    filtered = filtered.filter(cap => !deniedForSolo.includes(cap));
    
    // Add solo-specific capabilities (if not already present)
    const soloCapabilities = ['platform_catalog_services', 'professional_profile'];
    soloCapabilities.forEach(cap => {
      if (!filtered.includes(cap)) {
        filtered.push(cap);
      }
    });
  }
  
  return filtered;
}

/**
 * Stage 2: Filter capabilities by selected service styles
 * Only capabilities tied to selected service styles are enabled
 * - If capability has service style dependency, only include if style is selected
 * - If capability has no dependency, always include
 */
export function filterCapabilitiesByServiceStyles(
  selectedServiceStyles: string[],
  stage1Capabilities: string[],
  capabilityRules?: any
): string[] {
  if (!capabilityRules?.serviceStyleDependencies) {
    // No dependencies defined, return as-is (but still check default mappings)
    const defaultDeps = { ...SERVICE_STYLE_CAPABILITIES };
    return filterByServiceStyleDependencies(
      selectedServiceStyles,
      stage1Capabilities,
      defaultDeps
    );
  }
  
  const { serviceStyleDependencies } = capabilityRules;
  
  // Merge with default mappings
  const allDependencies = { ...SERVICE_STYLE_CAPABILITIES, ...serviceStyleDependencies };
  
  return filterByServiceStyleDependencies(
    selectedServiceStyles,
    stage1Capabilities,
    allDependencies
  );
}

/**
 * Helper: Filter capabilities based on service style dependencies
 */
function filterByServiceStyleDependencies(
  selectedServiceStyles: string[],
  capabilities: string[],
  dependencies: Record<string, string[]>
): string[] {
  // Build map of capabilities to their required service styles
  const capabilityToStyles: Record<string, string[]> = {};
  
  Object.entries(dependencies).forEach(([style, deps]) => {
    (deps as string[]).forEach(cap => {
      if (!capabilityToStyles[cap]) {
        capabilityToStyles[cap] = [];
      }
      capabilityToStyles[cap].push(style);
    });
  });
  
  // Filter capabilities
  const finalCapabilities = capabilities.filter(cap => {
    // If capability is tied to a service style
    if (capabilityToStyles[cap]) {
      // Only include if at least one required style is selected
      const requiredStyles = capabilityToStyles[cap];
      return requiredStyles.some(style => selectedServiceStyles.includes(style));
    }
    
    // Capability not tied to any style - always include
    return true;
  });
  
  return finalCapabilities;
}

/**
 * Complete two-stage capability filtering
 * Returns both stage results for debugging/logging
 */
export function getEffectiveCapabilities(
  options: CapabilityFilterOptions
): {
  stage1_solo_business: string[];
  stage2_service_styles: string[]; // FINAL - use this
} {
  // Stage 1: Solo/Business filtering
  const stage1Capabilities = filterCapabilitiesByVendorConfiguration(options);
  
  // Stage 2: Service style filtering
  const stage2Capabilities = filterCapabilitiesByServiceStyles(
    options.selectedServiceStyles,
    stage1Capabilities,
    options.capabilityRules
  );
  
  return {
    stage1_solo_business: stage1Capabilities,
    stage2_service_styles: stage2Capabilities // FINAL
  };
}

/**
 * Validate service style selection against vendorConfiguration
 * - Solo vendors cannot select 'at_center'
 * - Business vendors can select all styles
 */
export function validateServiceStyleSelection(
  vendorConfiguration: 'solo' | 'business',
  selectedStyles: string[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (vendorConfiguration === 'solo') {
    if (selectedStyles.includes('at_center')) {
      errors.push('Solo vendors cannot select "at_center" service style');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get allowed service styles for a vendorConfiguration
 */
export function getAllowedServiceStyles(
  vendorConfiguration: 'solo' | 'business'
): string[] {
  if (vendorConfiguration === 'solo') {
    return ['at_home', 'tele'];
  }
  return ['at_center', 'at_home', 'tele', 'delivery'];
}
