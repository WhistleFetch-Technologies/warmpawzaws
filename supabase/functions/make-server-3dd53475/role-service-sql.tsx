/**
 * ============================================================================
 * ROLE SERVICE - SQL-ONLY VERSION
 * ============================================================================
 * 
 * ✅ SQL-ONLY: Removed all KV usage, using SQL repositories only
 * 
 * ✅ GAP #5 FIX: CENTRALIZED ROLE SERVICE
 * Single source of truth for vendor role management
 * 
 * CHANGES:
 * - Removed `kv` imports
 * - Replaced `kv.getByPrefix('role:custom:')` with SQL queries
 * - Uses `RolesRepository` and `roles` table for custom roles
 * - All canonical roles remain in-memory for performance
 * 
 * Date: 2025-01-28
 * Migration: Batch 10 Phase 1 - KV to SQL (6 KV operations removed)
 * ============================================================================
 */

import { getRolesRepository } from '../../lib/repositories/roles.ts';
import { getDbClient } from '../../lib/db.ts';

const db = getDbClient();
const rolesRepo = getRolesRepository();

// =============================================
// CANONICAL VENDOR ROLE DEFINITIONS
// =============================================

export interface VendorRole {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: string;
  permissions: string[];
  serviceCategories: string[];
  requiresLicense: boolean;
  requiresCertification: boolean;
  allowsStaff: boolean;
  allowsAtHome: boolean;
  allowsAtCenter: boolean;
  allowsTele: boolean;
  isActive: boolean;
}

/**
 * CANONICAL VENDOR ROLES
 * This is the single source of truth for all vendor roles in the system
 */
export const VENDOR_ROLES: VendorRole[] = [
  {
    id: 'role_veterinarian',
    name: 'veterinarian',
    displayName: 'Veterinarian',
    description: 'Licensed veterinarian providing medical care',
    category: 'medical',
    permissions: ['diagnose', 'prescribe', 'surgery', 'emergency'],
    serviceCategories: ['Veterinary', 'Consultation', 'Emergency'],
    requiresLicense: true,
    requiresCertification: true,
    allowsStaff: true,
    allowsAtHome: true,
    allowsAtCenter: true,
    allowsTele: true,
    isActive: true
  },
  {
    id: 'role_vet_clinic',
    name: 'vet_clinic',
    displayName: 'Vet Clinic',
    description: 'Veterinary clinic with multiple doctors',
    category: 'medical',
    permissions: ['diagnose', 'prescribe', 'surgery', 'emergency', 'manage_staff'],
    serviceCategories: ['Veterinary', 'Consultation', 'Emergency', 'Surgery'],
    requiresLicense: true,
    requiresCertification: true,
    allowsStaff: true,
    allowsAtHome: false,
    allowsAtCenter: true,
    allowsTele: true,
    isActive: true
  },
  {
    id: 'role_groomer',
    name: 'groomer',
    displayName: 'Pet Groomer',
    description: 'Professional pet grooming services',
    category: 'grooming',
    permissions: ['groom', 'style', 'bathe'],
    serviceCategories: ['Grooming', 'Bath', 'Styling'],
    requiresLicense: false,
    requiresCertification: true,
    allowsStaff: true,
    allowsAtHome: true,
    allowsAtCenter: true,
    allowsTele: false,
    isActive: true
  },
  {
    id: 'role_grooming_center',
    name: 'grooming_center',
    displayName: 'Grooming Center',
    description: 'Grooming center with multiple groomers',
    category: 'grooming',
    permissions: ['groom', 'style', 'bathe', 'manage_staff'],
    serviceCategories: ['Grooming', 'Bath', 'Styling', 'Spa'],
    requiresLicense: false,
    requiresCertification: true,
    allowsStaff: true,
    allowsAtHome: false,
    allowsAtCenter: true,
    allowsTele: false,
    isActive: true
  },
  {
    id: 'role_trainer',
    name: 'trainer',
    displayName: 'Pet Trainer',
    description: 'Professional pet training and behavior modification',
    category: 'training',
    permissions: ['train', 'behavior', 'obedience'],
    serviceCategories: ['Training', 'Behavior', 'Obedience'],
    requiresLicense: false,
    requiresCertification: true,
    allowsStaff: true,
    allowsAtHome: true,
    allowsAtCenter: true,
    allowsTele: true,
    isActive: true
  },
  {
    id: 'role_training_center',
    name: 'training_center',
    displayName: 'Training Center',
    description: 'Pet training facility with multiple trainers',
    category: 'training',
    permissions: ['train', 'behavior', 'obedience', 'manage_staff'],
    serviceCategories: ['Training', 'Behavior', 'Obedience', 'Agility'],
    requiresLicense: false,
    requiresCertification: true,
    allowsStaff: true,
    allowsAtHome: false,
    allowsAtCenter: true,
    allowsTele: true,
    isActive: true
  },
  {
    id: 'role_walker',
    name: 'walker',
    displayName: 'Pet Walker',
    description: 'Professional pet walking services',
    category: 'walking',
    permissions: ['walk', 'exercise', 'track_gps'],
    serviceCategories: ['Walking', 'Exercise'],
    requiresLicense: false,
    requiresCertification: false,
    allowsStaff: true,
    allowsAtHome: true,
    allowsAtCenter: false,
    allowsTele: false,
    isActive: true
  },
  {
    id: 'role_behaviourist',
    name: 'behaviourist',
    displayName: 'Animal Behaviourist',
    description: 'Specialized animal behavior consultant',
    category: 'behavior',
    permissions: ['behavior', 'consult', 'diagnose_behavior'],
    serviceCategories: ['Behavior', 'Consultation'],
    requiresLicense: false,
    requiresCertification: true,
    allowsStaff: true,
    allowsAtHome: true,
    allowsAtCenter: true,
    allowsTele: true,
    isActive: true
  },
  {
    id: 'role_boarding_center',
    name: 'boarding_center',
    displayName: 'Boarding Center',
    description: 'Pet boarding and daycare facility',
    category: 'boarding',
    permissions: ['board', 'daycare', 'overnight', 'manage_staff'],
    serviceCategories: ['Boarding', 'Daycare'],
    requiresLicense: true,
    requiresCertification: true,
    allowsStaff: true,
    allowsAtHome: false,
    allowsAtCenter: true,
    allowsTele: false,
    isActive: true
  },
  {
    id: 'role_resort',
    name: 'resort',
    displayName: 'Pet Resort',
    description: 'Luxury pet resort with premium services',
    category: 'boarding',
    permissions: ['board', 'daycare', 'overnight', 'spa', 'manage_staff'],
    serviceCategories: ['Boarding', 'Daycare', 'Spa', 'Grooming'],
    requiresLicense: true,
    requiresCertification: true,
    allowsStaff: true,
    allowsAtHome: false,
    allowsAtCenter: true,
    allowsTele: false,
    isActive: true
  },
  {
    id: 'role_cafes',
    name: 'cafes',
    displayName: 'Pet Café',
    description: 'Pet-friendly café with dining and play area',
    category: 'hospitality',
    permissions: ['host', 'serve', 'manage_tables'],
    serviceCategories: ['Café', 'Dining'],
    requiresLicense: true,
    requiresCertification: false,
    allowsStaff: true,
    allowsAtHome: false,
    allowsAtCenter: true,
    allowsTele: false,
    isActive: true
  },
  {
    id: 'role_photography',
    name: 'photography',
    displayName: 'Pet Photographer',
    description: 'Professional pet photography services',
    category: 'creative',
    permissions: ['photograph', 'edit', 'deliver'],
    serviceCategories: ['Photography'],
    requiresLicense: false,
    requiresCertification: false,
    allowsStaff: true,
    allowsAtHome: true,
    allowsAtCenter: true,
    allowsTele: false,
    isActive: true
  },
  {
    id: 'role_breeder',
    name: 'breeder',
    displayName: 'Pet Breeder',
    description: 'Licensed pet breeding services',
    category: 'breeding',
    permissions: ['breed', 'sell', 'certify'],
    serviceCategories: ['Breeding', 'Sales'],
    requiresLicense: true,
    requiresCertification: true,
    allowsStaff: false,
    allowsAtHome: false,
    allowsAtCenter: true,
    allowsTele: false,
    isActive: true
  },
  {
    id: 'role_ambulance',
    name: 'ambulance',
    displayName: 'Pet Ambulance',
    description: 'Emergency pet ambulance services',
    category: 'emergency',
    permissions: ['emergency', 'transport', 'first_aid', 'track_gps'],
    serviceCategories: ['Emergency', 'Transport'],
    requiresLicense: true,
    requiresCertification: true,
    allowsStaff: true,
    allowsAtHome: true,
    allowsAtCenter: false,
    allowsTele: false,
    isActive: true
  },
  {
    id: 'role_nutritionist',
    name: 'nutritionist',
    displayName: 'Pet Nutritionist',
    description: 'Specialized pet nutrition consultant',
    category: 'nutrition',
    permissions: ['consult', 'prescribe_diet', 'meal_plan'],
    serviceCategories: ['Nutrition', 'Consultation'],
    requiresLicense: false,
    requiresCertification: true,
    allowsStaff: true,
    allowsAtHome: true,
    allowsAtCenter: true,
    allowsTele: true,
    isActive: true
  },
  {
    id: 'role_relocation',
    name: 'relocation',
    displayName: 'Pet Relocation',
    description: 'Pet relocation and transport services',
    category: 'logistics',
    permissions: ['relocate', 'transport', 'documentation', 'track_gps'],
    serviceCategories: ['Relocation', 'Transport'],
    requiresLicense: true,
    requiresCertification: true,
    allowsStaff: true,
    allowsAtHome: true,
    allowsAtCenter: false,
    allowsTele: false,
    isActive: true
  },
  {
    id: 'role_insurance',
    name: 'insurance',
    displayName: 'Pet Insurance',
    description: 'Pet insurance provider',
    category: 'insurance',
    permissions: ['insure', 'claim', 'policy'],
    serviceCategories: ['Insurance'],
    requiresLicense: true,
    requiresCertification: true,
    allowsStaff: true,
    allowsAtHome: false,
    allowsAtCenter: true,
    allowsTele: true,
    isActive: true
  },
  {
    id: 'role_adoption',
    name: 'adoption',
    displayName: 'Adoption Center',
    description: 'Pet adoption and rescue services',
    category: 'adoption',
    permissions: ['adopt', 'rescue', 'foster'],
    serviceCategories: ['Adoption', 'Rescue'],
    requiresLicense: true,
    requiresCertification: true,
    allowsStaff: true,
    allowsAtHome: false,
    allowsAtCenter: true,
    allowsTele: false,
    isActive: true
  },
  {
    id: 'role_sunset',
    name: 'sunset',
    displayName: 'Pet Memorial Services',
    description: 'End-of-life care and memorial services',
    category: 'memorial',
    permissions: ['memorial', 'cremation', 'burial'],
    serviceCategories: ['Memorial', 'End-of-Life'],
    requiresLicense: true,
    requiresCertification: true,
    allowsStaff: true,
    allowsAtHome: true,
    allowsAtCenter: true,
    allowsTele: true,
    isActive: true
  }
];

// =============================================
// ROLE SERVICE CLASS
// =============================================

class RoleService {
  private rolesCache: Map<string, VendorRole> = new Map();
  private rolesByName: Map<string, VendorRole> = new Map();
  private initialized: boolean = false;

  constructor() {
    this.initializeCache();
  }

  /**
   * Initialize role cache from canonical definitions
   */
  private initializeCache(): void {
    if (this.initialized) return;

    for (const role of VENDOR_ROLES) {
      this.rolesCache.set(role.id, role);
      this.rolesByName.set(role.name, role);
      
      // Also map variations (role_veterinarian → veterinarian)
      if (role.id.startsWith('role_')) {
        const shortName = role.id.replace('role_', '');
        this.rolesByName.set(shortName, role);
      }
    }

    this.initialized = true;
    console.log(`✅ [ROLE SERVICE] Initialized with ${VENDOR_ROLES.length} canonical roles`);
  }

  /**
   * Get all active vendor roles
   */
  getAllRoles(): VendorRole[] {
    return VENDOR_ROLES.filter(r => r.isActive);
  }

  /**
   * Get role by ID
   */
  getRoleById(roleId: string): VendorRole | null {
    // Try exact match
    let role = this.rolesCache.get(roleId);
    if (role) return role;

    // Try with 'role_' prefix
    if (!roleId.startsWith('role_')) {
      role = this.rolesCache.get(`role_${roleId}`);
      if (role) return role;
    }

    // Try by name
    role = this.rolesByName.get(roleId);
    if (role) return role;

    console.warn(`⚠️ [ROLE SERVICE] Role not found: ${roleId}`);
    return null;
  }

  /**
   * Get role by name (veterinarian, groomer, etc.)
   */
  getRoleByName(name: string): VendorRole | null {
    return this.rolesByName.get(name) || null;
  }

  /**
   * Validate if role ID exists
   */
  isValidRole(roleId: string): boolean {
    return this.getRoleById(roleId) !== null;
  }

  /**
   * Get roles by category
   */
  getRolesByCategory(category: string): VendorRole[] {
    return VENDOR_ROLES.filter(r => r.category === category && r.isActive);
  }

  /**
   * Check if role allows specific service style
   */
  roleAllowsServiceStyle(roleId: string, style: 'at_home' | 'at_center' | 'tele'): boolean {
    const role = this.getRoleById(roleId);
    if (!role) return false;

    switch (style) {
      case 'at_home': return role.allowsAtHome;
      case 'at_center': return role.allowsAtCenter;
      case 'tele': return role.allowsTele;
      default: return false;
    }
  }

  /**
   * Check if role requires license
   */
  requiresLicense(roleId: string): boolean {
    const role = this.getRoleById(roleId);
    return role ? role.requiresLicense : false;
  }

  /**
   * Check if role requires certification
   */
  requiresCertification(roleId: string): boolean {
    const role = this.getRoleById(roleId);
    return role ? role.requiresCertification : false;
  }

  /**
   * Check if role allows staff management
   */
  allowsStaff(roleId: string): boolean {
    const role = this.getRoleById(roleId);
    return role ? role.allowsStaff : false;
  }

  /**
   * Get display name for role
   */
  getDisplayName(roleId: string): string {
    const role = this.getRoleById(roleId);
    return role ? role.displayName : roleId;
  }

  /**
   * Get role permissions
   */
  getPermissions(roleId: string): string[] {
    const role = this.getRoleById(roleId);
    return role ? role.permissions : [];
  }

  /**
   * Get service categories for role
   */
  getServiceCategories(roleId: string): string[] {
    const role = this.getRoleById(roleId);
    return role ? role.serviceCategories : [];
  }

  /**
   * Normalize role ID (handle variations)
   */
  normalizeRoleId(roleId: string): string {
    const role = this.getRoleById(roleId);
    return role ? role.id : roleId;
  }

  /**
   * Get all role names (for dropdowns, etc.)
   */
  getAllRoleNames(): string[] {
    return VENDOR_ROLES.filter(r => r.isActive).map(r => r.name);
  }

  /**
   * Get all role IDs
   */
  getAllRoleIds(): string[] {
    return VENDOR_ROLES.filter(r => r.isActive).map(r => r.id);
  }

  /**
   * Check if role is medical-related
   */
  isMedicalRole(roleId: string): boolean {
    const role = this.getRoleById(roleId);
    return role ? role.category === 'medical' : false;
  }

  /**
   * Check if role requires GPS tracking
   */
  requiresGPSTracking(roleId: string): boolean {
    const role = this.getRoleById(roleId);
    if (!role) return false;
    
    return role.permissions.includes('track_gps');
  }

  /**
   * Load roles from SQL database (for custom roles)
   * ✅ SQL: Replaced KV with SQL queries
   */
  async loadCustomRoles(): Promise<VendorRole[]> {
    try {
      // ✅ SQL: Get custom roles from roles table
      const { data: customRoles, error } = await db
        .from('roles')
        .select('*')
        .eq('is_custom', true)
        .eq('is_active', true);
      
      if (error) {
        console.warn('⚠️ [ROLE SERVICE] Custom roles not loaded (using defaults only):', error.message);
        return [];
      }
      
      // Map database roles to VendorRole format
      const mappedRoles = (customRoles || []).map((role: any) => ({
        id: role.role_id || role.id,
        name: role.role_name || role.name,
        displayName: role.display_name || role.role_name || role.name,
        description: role.description || '',
        category: role.category || 'general',
        permissions: role.permissions || [],
        serviceCategories: role.service_categories || [],
        requiresLicense: role.requires_license || false,
        requiresCertification: role.requires_certification || false,
        allowsStaff: role.allows_staff || false,
        allowsAtHome: role.allows_at_home || false,
        allowsAtCenter: role.allows_at_center || false,
        allowsTele: role.allows_tele || false,
        isActive: role.is_active !== false
      }));
      
      console.log(`📥 [ROLE SERVICE] Loaded ${mappedRoles.length} custom roles from SQL`);
      return mappedRoles;
    } catch (error: any) {
      console.warn('⚠️ [ROLE SERVICE] Custom roles not loaded (using defaults only):', error.message);
      return [];
    }
  }
}

// =============================================
// SINGLETON INSTANCE
// =============================================

export const roleService = new RoleService();

// =============================================
// CONVENIENCE EXPORTS
// =============================================

/**
 * Get all vendor roles
 */
export function getAllVendorRoles(): VendorRole[] {
  return roleService.getAllRoles();
}

/**
 * Get role by ID or name
 */
export function getVendorRole(identifier: string): VendorRole | null {
  return roleService.getRoleById(identifier);
}

/**
 * Validate role
 */
export function isValidVendorRole(roleId: string): boolean {
  return roleService.isValidRole(roleId);
}

/**
 * Get role display name
 */
export function getRoleDisplayName(roleId: string): string {
  return roleService.getDisplayName(roleId);
}

/**
 * Check if role allows service style
 */
export function roleSupportsServiceStyle(
  roleId: string,
  style: 'at_home' | 'at_center' | 'tele'
): boolean {
  return roleService.roleAllowsServiceStyle(roleId, style);
}

/**
 * Initialize role service (call on server startup)
 */
export async function initializeRoleService(): Promise<void> {
  console.log('🚀 [ROLE SERVICE] Initializing...');
  
  try {
    // Load any custom roles from SQL (with timeout protection)
    const customRolesPromise = Promise.race([
      roleService.loadCustomRoles(),
      new Promise<VendorRole[]>((resolve) => setTimeout(() => {
        console.warn('⚠️ [ROLE SERVICE] Custom role loading timed out, continuing with defaults');
        resolve([]);
      }, 2000))
    ]);
    
    const customRoles = await customRolesPromise;
    
    console.log('✅ [ROLE SERVICE] Initialization complete');
    console.log(`   - Canonical roles: ${VENDOR_ROLES.length}`);
    console.log(`   - Custom roles: ${customRoles.length}`);
  } catch (error) {
    console.error('❌ [ROLE SERVICE] Initialization error (non-critical):', error);
    console.log('✅ [ROLE SERVICE] Continuing with canonical roles only');
  }
}

// =============================================
// ROLE VALIDATION HELPERS
// =============================================

/**
 * Validate vendor role configuration
 */
export function validateVendorRoleConfig(vendorData: any): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if role exists
  if (!vendorData.roleId && !vendorData.role) {
    errors.push('Role ID is required');
  } else {
    const roleId = vendorData.roleId || vendorData.role;
    const role = roleService.getRoleById(roleId);
    
    if (!role) {
      errors.push(`Invalid role: ${roleId}`);
    } else {
      // Check license requirements
      if (role.requiresLicense && !vendorData.licenseNumber) {
        warnings.push(`${role.displayName} typically requires a license`);
      }

      // Check certification requirements
      if (role.requiresCertification && !vendorData.certifications) {
        warnings.push(`${role.displayName} typically requires certification`);
      }

      // Check service style compatibility
      if (vendorData.serviceStyle) {
        const styles = Array.isArray(vendorData.serviceStyle) 
          ? vendorData.serviceStyle 
          : [vendorData.serviceStyle];

        for (const style of styles) {
          if (!roleService.roleAllowsServiceStyle(roleId, style)) {
            errors.push(`${role.displayName} does not support ${style} service style`);
          }
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Get recommended service categories for role
 */
export function getRecommendedServicesForRole(roleId: string): string[] {
  return roleService.getServiceCategories(roleId);
}

// Export service instance as default
export default roleService;
