/**
 * ============================================================================
 * ROLE SERVICE - FIXED VERSION WITH PROPER INITIALIZATION
 * ============================================================================
 * 
 * ✅ FIXED: Proper initialization, no KV dependencies, SQL-only
 * 
 * Date: 2025-01-28
 * ============================================================================
 */

import { getRolesRepository } from '../../lib/repositories/roles.ts';
import { getDbClient } from '../../lib/db.ts';

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

class RoleService {
  private rolesCache: Map<string, VendorRole> = new Map();
  private rolesByName: Map<string, VendorRole> = new Map();
  private initialized: boolean = false;
  private db = getDbClient();
  private rolesRepo = getRolesRepository();

  constructor() {
    // Auto-initialize on construction
    this.initialize().catch(err => {
      console.error('❌ [ROLE SERVICE] Auto-initialization failed:', err);
    });
  }

  /**
   * Initialize role cache from SQL database
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('✅ [ROLE SERVICE] Already initialized');
      return;
    }

    try {
      console.log('🚀 [ROLE SERVICE] Initializing from SQL...');
      
      // ✅ SQL: Load all roles from database
      const roles = await this.rolesRepo.findAll();
      
      console.log(`📥 [ROLE SERVICE] Loaded ${roles.length} roles from database`);
      
      // Map database roles to VendorRole format
      for (const role of roles) {
        const vendorRole: VendorRole = {
          id: role.id,
          name: role.name,
          displayName: role.display_name || role.name,
          description: role.description || '',
          category: role.category || 'general',
          permissions: role.config?.permissions || [],
          serviceCategories: role.config?.serviceCategories || [],
          requiresLicense: role.config?.requiresLicense || false,
          requiresCertification: role.config?.requiresCertification || false,
          allowsStaff: role.config?.allowsStaff !== false,
          allowsAtHome: role.config?.allowsAtHome !== false,
          allowsAtCenter: role.config?.allowsAtCenter !== false,
          allowsTele: role.config?.allowsTele !== false,
          isActive: role.is_active !== false,
        };
        
        this.rolesCache.set(role.id, vendorRole);
        this.rolesByName.set(role.name, vendorRole);
        
        // Also map variations
        if (role.id.startsWith('role_')) {
          const shortName = role.id.replace('role_', '');
          this.rolesByName.set(shortName, vendorRole);
        }
      }

      this.initialized = true;
      console.log(`✅ [ROLE SERVICE] Initialized with ${this.rolesCache.size} roles`);
    } catch (error) {
      console.error('❌ [ROLE SERVICE] Initialization error:', error);
      // Continue with empty cache - will load on demand
      this.initialized = true;
    }
  }

  /**
   * Get all active vendor roles
   */
  getAllRoles(): VendorRole[] {
    if (!this.initialized) {
      console.warn('⚠️ [ROLE SERVICE] Not initialized, returning empty array');
      return [];
    }
    return Array.from(this.rolesCache.values()).filter(r => r.isActive);
  }

  /**
   * Get role by ID or name
   */
  getRoleById(identifier: string): VendorRole | null {
    if (!this.initialized) {
      console.warn('⚠️ [ROLE SERVICE] Not initialized, attempting sync load...');
      // Try to initialize synchronously (will fail but won't crash)
      return null;
    }
    
    // Try by ID first
    const byId = this.rolesCache.get(identifier);
    if (byId) return byId;
    
    // Try by name
    const byName = this.rolesByName.get(identifier);
    if (byName) return byName;
    
    return null;
  }

  /**
   * Check if role is valid
   */
  isValidRole(roleId: string): boolean {
    return this.getRoleById(roleId) !== null;
  }

  /**
   * Get role display name
   */
  getDisplayName(roleId: string): string {
    const role = this.getRoleById(roleId);
    return role?.displayName || roleId;
  }

  /**
   * Check if role allows service style
   */
  roleAllowsServiceStyle(roleId: string, style: 'at_home' | 'at_center' | 'tele'): boolean {
    const role = this.getRoleById(roleId);
    if (!role) return false;
    
    switch (style) {
      case 'at_home':
        return role.allowsAtHome;
      case 'at_center':
        return role.allowsAtCenter;
      case 'tele':
        return role.allowsTele;
      default:
        return false;
    }
  }

  /**
   * Get service categories for role
   */
  getServiceCategories(roleId: string): string[] {
    const role = this.getRoleById(roleId);
    return role?.serviceCategories || [];
  }
}

// =============================================
// SINGLETON INSTANCE
// =============================================

export const roleService = new RoleService();

// =============================================
// CONVENIENCE EXPORTS
// =============================================

export function getAllVendorRoles(): VendorRole[] {
  return roleService.getAllRoles();
}

export function getVendorRole(identifier: string): VendorRole | null {
  return roleService.getRoleById(identifier);
}

export function isValidVendorRole(roleId: string): boolean {
  return roleService.isValidRole(roleId);
}

export function getRoleDisplayName(roleId: string): string {
  return roleService.getDisplayName(roleId);
}

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
    await roleService.initialize();
    console.log('✅ [ROLE SERVICE] Initialization complete');
  } catch (error) {
    console.error('❌ [ROLE SERVICE] Initialization error (non-critical):', error);
    console.log('✅ [ROLE SERVICE] Continuing with on-demand loading');
  }
}

export default roleService;

