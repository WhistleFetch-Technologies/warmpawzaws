"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoleServiceInstance = exports.VENDOR_ROLES = void 0;
exports.getRoleService = getRoleService;
const db_1 = require("../lib/db");
/**
 * CANONICAL VENDOR ROLES
 * This is the single source of truth for all vendor roles in the system
 */
exports.VENDOR_ROLES = [
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
    // ... Add more roles as needed
];
class RoleService {
    roles = [];
    customRoles = [];
    initialized = false;
    /**
     * Initialize role service
     */
    async initialize() {
        if (this.initialized)
            return;
        // ✅ SQL: Load custom roles from database
        const pool = await (0, db_1.getDbClient)();
        try {
            const settingsResult = await pool.query('SELECT setting_value FROM platform_settings WHERE setting_key = $1', ['vendor_roles:custom']);
            const data = settingsResult.rows[0] || null;
            if (data?.setting_value) {
                this.customRoles = data.setting_value;
            }
        }
        catch (err) {
            console.warn('Could not load custom roles from database');
        }
        this.roles = [...exports.VENDOR_ROLES, ...this.customRoles];
        this.initialized = true;
    }
    /**
     * Get all roles
     */
    async getAllRoles() {
        await this.initialize();
        return this.roles.filter(r => r.isActive);
    }
    /**
     * Get role by ID
     */
    async getRoleById(roleId) {
        await this.initialize();
        return this.roles.find(r => r.id === roleId && r.isActive) || null;
    }
    /**
     * Get role by name
     */
    async getRoleByName(name) {
        await this.initialize();
        return this.roles.find(r => r.name === name && r.isActive) || null;
    }
    /**
     * Validate role permissions
     */
    async validatePermission(roleId, permission) {
        const role = await this.getRoleById(roleId);
        if (!role)
            return false;
        return role.permissions.includes(permission);
    }
    /**
     * Get service styles allowed for role
     */
    async getAllowedServiceStyles(roleId) {
        const role = await this.getRoleById(roleId);
        if (!role)
            return [];
        const styles = [];
        if (role.allowsAtHome)
            styles.push('at_home');
        if (role.allowsAtCenter)
            styles.push('at_center');
        if (role.allowsTele)
            styles.push('tele');
        return styles;
    }
}
let roleServiceInstance = null;
function getRoleService() {
    if (!roleServiceInstance) {
        roleServiceInstance = new RoleService();
    }
    return roleServiceInstance;
}
// Export for backwards compatibility - renamed to avoid conflict
exports.RoleServiceInstance = getRoleService();
//# sourceMappingURL=role-service-sql.js.map