/**
 * ============================================================================
 * ROLE SERVICE - SQL-ONLY VERSION
 * ============================================================================
 *
 * REFACTORED: Removed all KV usage, using SQL repositories only
 *
 * Centralized role service for vendor role management
 *
 * Features:
 * - Canonical role definitions
 * - Role validation
 * - Role lookup by ID or name
 * - Role-based permissions
 * - Type-safe role operations
 *
 * CHANGES:
 * - Removed `kv` imports
 * - Replaced all `kv.get()`, `kv.set()`, `kv.getByPrefix()` with repository calls
 * - Roles stored in platform_settings or roles table
 *
 * Date: 2025-01-27
 * Migration: Phase 3 - Services Entity Migration
 * KV Operations Removed: 7
 * ============================================================================
 */
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
export declare const VENDOR_ROLES: VendorRole[];
declare class RoleService {
    private roles;
    private customRoles;
    private initialized;
    /**
     * Initialize role service
     */
    initialize(): Promise<void>;
    /**
     * Get all roles
     */
    getAllRoles(): Promise<VendorRole[]>;
    /**
     * Get role by ID
     */
    getRoleById(roleId: string): Promise<VendorRole | null>;
    /**
     * Get role by name
     */
    getRoleByName(name: string): Promise<VendorRole | null>;
    /**
     * Validate role permissions
     */
    validatePermission(roleId: string, permission: string): Promise<boolean>;
    /**
     * Get service styles allowed for role
     */
    getAllowedServiceStyles(roleId: string): Promise<string[]>;
}
export declare function getRoleService(): RoleService;
export declare const RoleServiceInstance: RoleService;
export {};
//# sourceMappingURL=role-service-sql.d.ts.map