/**
 * ============================================================================
 * ROLE CONFIG ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * 
 * Endpoints:
 * - GET /config/roles - Get all roles
 * - GET /config/roles/:id - Get role by ID
 * - POST /config/roles - Create role (admin only)
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import { BaseHandler, HandlerContext, HandlerResponse } from '../handler/base-handler';
import { query, select, insert, update } from '../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';
import { getAdminPortalCapabilitiesApiPayload } from '@warmpawz/shared-types';

// ============================================================================
// CANONICAL SERVICE STYLES (Phase 1 - single source of truth)
// ============================================================================
const CANONICAL_SERVICE_STYLE_CODES = ['at_home', 'at_center', 'tele'] as const;
const LABEL_BY_CODE: Record<string, string> = {
  at_home: 'At Home',
  at_center: 'At Center',
  tele: 'Tele Consultation',
};
const ALIAS_TO_CODE: Record<string, string> = {
  at_center: 'at_center',
  at_clinic: 'at_center',
  at_vendor: 'at_center',
  at_home: 'at_home',
  home_visit: 'at_home',
  home_service: 'at_home',
  tele: 'tele',
  video_consultation: 'tele',
  tele_consultation: 'tele',
  online: 'tele',
  video: 'tele',
  // Label strings (from legacy or display) -> canonical
  'at home': 'at_home',
  'at center': 'at_center',
  'tele consultation': 'tele',
};

/** Extract canonical service style codes only (at_home, at_center, tele). No labels, no unknown values. */
function getCanonicalServiceStyles(config: any): string[] {
  const raw = config?.serviceStyles ?? config?.service_styles;
  const arr = Array.isArray(raw)
    ? raw
    : (raw && typeof raw === 'object' && (raw.selected || raw.solo)
        ? (raw.selected ?? raw.solo ?? [])
        : []);
  const codes = arr
    .map((s: string) => {
      if (!s || typeof s !== 'string') return null;
      const key = s.toLowerCase().trim().replace(/\s+/g, '_');
      const keyWithSpaces = s.toLowerCase().trim();
      const code = ALIAS_TO_CODE[key] ?? ALIAS_TO_CODE[keyWithSpaces] ?? (CANONICAL_SERVICE_STYLE_CODES.includes(key as any) ? key : null);
      return code;
    })
    .filter((c: string | null): c is string => !!c && CANONICAL_SERVICE_STYLE_CODES.includes(c as any));
  return [...new Set(codes)];
}

// ============================================================================
// ROLE HANDLERS
// ============================================================================

const KNOWN_ADMIN_PORTAL_ROLE_NAMES = new Set(['admin', 'super_admin', 'support_admin', 'admin_master']);

function hasAdminPortalPermission(permissionNames: string[]): boolean {
  return permissionNames.some((p) => {
    const s = String(p);
    return s.startsWith('admin.') || s.startsWith('admin:');
  });
}

/**
 * Admin-portal RBAC roles only (not pure vendor-dashboard roles).
 * - `role_type = admin` always counts.
 * - `role_type = vendor` still counts if the row has admin-scoped permissions (e.g. vendor ops / "Vendor Manager" with `admin.vendors`).
 * - Otherwise uses known system admin names or inferred admin permissions.
 */
function isAdminPortalRoleRow(role: Record<string, any>, permissionNames: string[]): boolean {
  const rt = String(role.role_type ?? '').toLowerCase();
  if (rt === 'admin') return true;
  if (hasAdminPortalPermission(permissionNames)) return true;
  if (rt === 'vendor') return false;
  const nm = String(role.name ?? '').toLowerCase();
  if (KNOWN_ADMIN_PORTAL_ROLE_NAMES.has(nm)) return true;
  return false;
}

class GetRolesHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    // ✅ SQL: Get all roles (both active and inactive for admin view)
    const queryParams = context.event.queryStringParameters || {};
    const onlyActive = queryParams.active === 'true' || !queryParams.active;
    const roleTypeFilter = String(queryParams.role_type || queryParams.type || '')
      .toLowerCase()
      .trim();

    const roles = await select('roles', onlyActive ? { is_active: true } : {}, {
      orderBy: 'display_name',
      orderDirection: 'ASC',
    });

    // OPTIMIZATION: Batch load all permissions in a single query instead of N+1 queries
    // This reduces database round trips from N+1 to just 2 queries (roles + permissions)
    let permissionsByRole: Map<string, string[]> = new Map();
    
    if (roles.length > 0) {
      const roleIds = roles.map(r => r.id);
      let allPermissions;
      
      try {
        // Cast role_id to text to avoid "uuid = text" error
        // PostgreSQL requires explicit casting when comparing UUID with text array
        allPermissions = await query(
          `SELECT role_id, permission_name 
           FROM role_permissions 
           WHERE role_id::text = ANY($1::text[])`,
          [roleIds]
        );
      } catch (error: any) {
        // Fallback to IN clause with explicit casting
        console.warn('[Roles] Array syntax failed, using IN clause fallback:', error.message);
        const placeholders = roleIds.map((_, i) => `$${i + 1}::text`).join(',');
        allPermissions = await query(
          `SELECT role_id, permission_name 
           FROM role_permissions 
           WHERE role_id::text IN (${placeholders})`,
          roleIds
        );
      }
      
      // Group permissions by role_id
      allPermissions.rows.forEach((p: any) => {
        const roleId = p.role_id;
        if (!permissionsByRole.has(roleId)) {
          permissionsByRole.set(roleId, []);
        }
        permissionsByRole.get(roleId)!.push(p.permission_name);
      });
    }

    let rolesForResponse = roles;
    if (roleTypeFilter === 'admin') {
      rolesForResponse = roles.filter((r: any) =>
        isAdminPortalRoleRow(r, permissionsByRole.get(r.id) || [])
      );
    } else if (roleTypeFilter === 'vendor') {
      rolesForResponse = roles.filter((r: any) => {
        const rt = String(r.role_type ?? '').toLowerCase();
        const perms = permissionsByRole.get(r.id) || [];
        if (rt === 'admin') return false;
        if (rt === 'vendor') {
          // Vendor-typed rows that only carry admin-portal permissions belong in admin RBAC, not vendor templates.
          const onlyAdminPortalPerms =
            perms.length > 0 &&
            perms.every((p) => {
              const s = String(p);
              return s.startsWith('admin.') || s.startsWith('admin:');
            });
          if (onlyAdminPortalPerms) return false;
          return true;
        }
        return !isAdminPortalRoleRow(r, perms);
      });
    }

    // Map roles with their permissions (no async operations needed now)
    const rolesWithFullData = rolesForResponse.map((role) => {
      const capabilities = permissionsByRole.get(role.id) || [];
        
        // Extract config fields from JSONB config column
        const config = role.config || {};
        const vendorTypes = config.vendorTypes || config.vendor_types || [];
        const vendorConfiguration = config.vendorConfiguration || null;
        const customerService = (role as any).customer_service || config.customer_service || null;
        const pricingControl = config.pricingControl || config.pricing_control || {
          canControlPrice: false,
          canControlDuration: false,
        };
        const category = config.category || 'general';
        const icon = config.icon || role.icon || null;
        // Phase 1: Canonical codes only (at_home, at_center, tele). Labels separate.
        const serviceStyles = getCanonicalServiceStyles(config);
        const serviceStylesLabels = Object.fromEntries(
          serviceStyles.map((c) => [c, LABEL_BY_CODE[c] || c])
        );
        
        // Parse vendorTypes to match reference (organization, Service Provider, Seller, Healthcare Provider)
        const normalizedVendorTypes = Array.isArray(vendorTypes) 
          ? vendorTypes.map((vt: string) => {
              const mapping: Record<string, string> = {
                'healthcare_provider': 'Healthcare Provider',
                'service_provider': 'Service Provider',
                'solo_provider': 'Service Provider',
                'center': 'Healthcare Provider',
                'organization': 'organization',
                'seller': 'Seller',
                'business': 'Business',
                'ngo': 'NGO',
              };
              return mapping[vt] || vt;
            })
          : [];
        
        return {
          ...role,
          id: role.id,
          roleId: role.id,
          roleName: role.display_name || role.name,
          roleCode: role.name,
          display_name: role.display_name || role.name,
          name: role.name,
          description: role.description || '',
          category,
          icon,
          customer_service: customerService,
          vendorConfiguration: vendorConfiguration,
          vendorTypes: normalizedVendorTypes,
          serviceStyles,
          serviceStylesLabels,
          pricingControl: {
            canControlPrice: pricingControl.canControlPrice || pricingControl.can_control_price || false,
            canControlDuration: pricingControl.canControlDuration || pricingControl.can_control_duration || false,
          },
          capabilities,
          isActive: role.is_active !== false,
          isSystem: role.is_system_role || false,
          userCount: 0, // TODO: Count users with this role
          createdAt: role.created_at || new Date().toISOString(),
          // ✅ NEW: Return full config object so frontend can access capabilityRules, serviceStyles structure, etc.
          config: role.config || {},
        };
    });

    return this.success({ 
      success: true,
      roles: rolesWithFullData,
      total: rolesWithFullData.length 
    });
  }
}

/** Normalize role id from path: trim and strip optional { } so UUID matches DB. */
function normalizeRoleIdFromPath(roleId: string): string {
  const s = (roleId || '').trim();
  if (s.length >= 38 && s.startsWith('{') && s.endsWith('}')) {
    return s.slice(1, -1).trim();
  }
  return s;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class GetRoleByIdHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const rawRoleId = context.event.pathParameters?.roleId;
    const roleId = normalizeRoleIdFromPath(rawRoleId ?? '');

    if (!roleId) {
      return this.error('Role ID is required', 400);
    }

    let roles: any[] = [];
    const isUuid = UUID_REGEX.test(roleId);

    if (isUuid) {
      // API contract: GET /config/roles/:id — resolve by primary key from DB (active roles only, same as list)
      const byId = await query(
        `SELECT * FROM roles WHERE id = $1::uuid AND is_active = true LIMIT 1`,
        [roleId]
      );
      if (byId?.rows?.length) roles = byId.rows;
    }

    if (roles.length === 0) {
      // Fallback: lookup by name (role code) — canonical names e.g. groomer_solo, vet_clinic
      const roleNameNorm = roleId.toLowerCase().replace(/\s+/g, '_');
      roles = await select('roles', { name: roleNameNorm, is_active: true });
    }
    if (roles.length === 0) {
      const byName = await query(
        `SELECT * FROM roles WHERE LOWER(name) = LOWER($1) AND is_active = true LIMIT 1`,
        [roleId]
      );
      if (byName?.rows?.length) roles = byName.rows;
    }
    if (roles.length === 0) {
      return this.error('Role not found', 404);
    }

    const role = roles[0];
    const effectiveRoleId = role.id; // Use role's UUID for role_permissions (FK references roles.id)
    const permissions = await select('role_permissions', { role_id: effectiveRoleId });
    const capabilities = permissions.map(p => p.permission_name);
    
    // Extract config fields from JSONB config column (same as GetRolesHandler)
    const config = role.config || {};
    const vendorTypes = config.vendorTypes || config.vendor_types || [];
    const pricingControl = config.pricingControl || config.pricing_control || {
      canControlPrice: false,
      canControlDuration: false,
    };
    const category = config.category || 'general';
    const icon = config.icon || role.icon || null;
    // Phase 1: Canonical codes only (at_home, at_center, tele). Labels separate.
    const serviceStyles = getCanonicalServiceStyles(config);
    const serviceStylesLabels = Object.fromEntries(
      serviceStyles.map((c) => [c, LABEL_BY_CODE[c] || c])
    );
    
    const normalizedVendorTypes = Array.isArray(vendorTypes) 
      ? vendorTypes.map((vt: string) => {
          const mapping: Record<string, string> = {
            'healthcare_provider': 'Healthcare Provider',
            'service_provider': 'Service Provider',
            'solo_provider': 'Service Provider',
            'center': 'Healthcare Provider',
            'organization': 'organization',
            'seller': 'Seller',
            'business': 'Business',
            'ngo': 'NGO',
          };
          return mapping[vt] || vt;
        })
      : [];

    return this.success({
      success: true,
      ...role,
      roleId: role.id,
      roleName: role.display_name || role.name,
      roleCode: role.name,
      category,
      icon,
      vendorTypes: normalizedVendorTypes,
      serviceStyles,
      serviceStylesLabels,
      pricingControl: {
        canControlPrice: pricingControl.canControlPrice || pricingControl.can_control_price || false,
        canControlDuration: pricingControl.canControlDuration || pricingControl.can_control_duration || false,
      },
      capabilities,
      isActive: role.is_active !== false,
      isSystem: role.is_system_role || false,
      updated_at: (role as any).updated_at || null,
      // ✅ Return full config object so frontend can access capabilityRules, etc. config.serviceStyles in DB may be object; API exposes canonical serviceStyles above.
      config: role.config || {},
    });
  }
}

class CreateRoleHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const { 
      name, 
      display_name, 
      roleName,
      roleCode,
      description, 
      category, 
      capabilities, 
      config,
      vendorTypes,
      serviceStyles,
      pricingControl,
      icon,
      isActive,
      is_active,
      vendorConfiguration,
      customer_service,
      capabilityRules
    } = body;

    // Validation - support both naming conventions
    const roleNameFinal = name || roleCode || '';
    const displayNameFinal = display_name || roleName || '';
    
    if (!roleNameFinal || !displayNameFinal) {
      return this.error('Name (or roleCode) and display_name (or roleName) are required', 400);
    }

    // Check if role already exists
    const existing = await select('roles', { name: roleNameFinal });
    if (existing.length > 0) {
      return this.error('Role with this name already exists', 409);
    }

    try {
      // Build config object - merge provided config with explicit fields
      const baseConfig: any = config || {};
      const roleConfig: any = {
        category: category || baseConfig.category || 'general',
        icon: icon || baseConfig.icon || null,
        vendorTypes: vendorTypes || baseConfig.vendorTypes || [],
        serviceStyles: serviceStyles || baseConfig.serviceStyles || [],
        pricingControl: pricingControl || baseConfig.pricingControl || {
          canControlPrice: false,
          canControlDuration: false,
        },
      };

      // Add vendorConfiguration if provided
      if (vendorConfiguration !== undefined) {
        roleConfig.vendorConfiguration = vendorConfiguration;
      }

      // Add customer_service if provided
      if (customer_service !== undefined) {
        roleConfig.customer_service = customer_service;
      }

      // Add capabilityRules if provided
      if (capabilityRules !== undefined) {
        roleConfig.capabilityRules = capabilityRules;
      }

      // Merge any additional fields from provided config object
      if (config && typeof config === 'object') {
        Object.assign(roleConfig, config);
      }

      // Insert role
      const roleData: any = {
        name: roleNameFinal,
        display_name: displayNameFinal,
        description: description || '',
        is_system_role: false,
        is_active: is_active !== undefined ? is_active : (isActive !== undefined ? isActive : true),
        config: roleConfig,
      };

      const capsArr = capabilities as unknown;
      const inferredAdminPortal =
        Array.isArray(capsArr) &&
        capsArr.length > 0 &&
        capsArr.every((c: unknown) => typeof c === 'string' && (c as string).startsWith('admin.'));
      const rtBody = String((body as any).role_type || '').toLowerCase();
      if (rtBody === 'admin' || rtBody === 'vendor') {
        roleData.role_type = rtBody;
      } else if (inferredAdminPortal) {
        roleData.role_type = 'admin';
      }

      const newRole = await insert('roles', roleData);
      const roleId = newRole[0].id;

      // Insert capabilities/permissions if provided
      if (capabilities && Array.isArray(capabilities) && capabilities.length > 0) {
        for (const capName of capabilities) {
          await insert('role_permissions', {
            role_id: roleId,
            permission_name: capName,
            resource: '*', // Default resource
            action: '*', // Default action
          }).catch(err => console.error('Error adding permission:', err));
        }
      }

      // Phase 1: Response returns canonical serviceStyles only; labels separate
      // Use distinct name to avoid TDZ: body.serviceStyles is used above; do not shadow with same name
      const canonicalServiceStyles = getCanonicalServiceStyles(roleConfig);
      const serviceStylesLabels = Object.fromEntries(
        canonicalServiceStyles.map((c) => [c, LABEL_BY_CODE[c] || c])
      );

      return this.success({
        success: true,
        message: 'Role created successfully',
        role: {
          ...newRole[0],
          roleId: newRole[0].id,
          roleName: newRole[0].display_name || newRole[0].name,
          roleCode: newRole[0].name,
          vendorTypes: roleConfig.vendorTypes || [],
          serviceStyles: canonicalServiceStyles,
          serviceStylesLabels,
          pricingControl: roleConfig.pricingControl || {
            canControlPrice: false,
            canControlDuration: false,
          },
          capabilities: capabilities || [],
          isActive: newRole[0].is_active !== false,
          updated_at: (newRole[0] as any).updated_at || null,
        },
      });
    } catch (error: any) {
      console.error('Error creating role:', error);
      return this.error(error.message || 'Failed to create role', 500);
    }
  }
}

class UpdateRoleHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const roleId = context.event.pathParameters?.roleId;
    const body = this.parseBody(context.event);
    const { 
      display_name, 
      roleName,
      description, 
      is_active, 
      isActive,
      capabilities, 
      config,
      vendorTypes,
      serviceStyles,
      pricingControl,
      category,
      icon,
      vendorConfiguration,
      customer_service,
      capabilityRules
    } = body;

    if (!roleId) {
      return this.error('Role ID is required', 400);
    }

    // Check if role exists
    const roles = await select('roles', { id: roleId });
    if (roles.length === 0) {
      return this.error('Role not found', 404);
    }

    const existingRole = roles[0];
    const existingConfig = existingRole.config || {};

    try {
      // Build config object from request body (merge with existing)
      const updatedConfig: any = {
        ...existingConfig,
        category: category !== undefined ? category : existingConfig.category,
        icon: icon !== undefined ? icon : existingConfig.icon,
        vendorTypes: vendorTypes !== undefined ? vendorTypes : existingConfig.vendorTypes || [],
        serviceStyles: serviceStyles !== undefined ? serviceStyles : existingConfig.serviceStyles || [],
        pricingControl: pricingControl !== undefined ? pricingControl : (existingConfig.pricingControl || {
          canControlPrice: false,
          canControlDuration: false,
        }),
      };

      // Save vendorConfiguration to config if provided
      if (vendorConfiguration !== undefined) {
        updatedConfig.vendorConfiguration = vendorConfiguration;
      }

      // Save customer_service to config if provided
      if (customer_service !== undefined) {
        updatedConfig.customer_service = customer_service;
      }

      // Save capabilityRules to config if provided
      if (capabilityRules !== undefined) {
        updatedConfig.capabilityRules = capabilityRules;
      }

      // If config object provided directly, merge it
      if (config && typeof config === 'object') {
        Object.assign(updatedConfig, config);
      }

      // Update role
      const updateData: any = {};
      if (display_name !== undefined || roleName !== undefined) {
        updateData.display_name = display_name || roleName;
      }
      if (description !== undefined) {
        updateData.description = description;
      }
      if (is_active !== undefined || isActive !== undefined) {
        updateData.is_active = is_active !== undefined ? is_active : isActive;
      }
      updateData.config = updatedConfig;

      if (Object.keys(updateData).length > 0) {
        await update('roles', { id: roleId }, updateData);
      }

      // Update capabilities if provided
      if (capabilities && Array.isArray(capabilities)) {
        // Delete existing permissions
        await query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]).catch(() => {});

        // Insert new permissions
        for (const capName of capabilities) {
          await insert('role_permissions', {
            role_id: roleId,
            permission_name: capName,
            resource: '*',
            action: '*',
          }).catch(err => console.error('Error adding permission:', err));
        }
      }

      // Fetch updated role with full data
      const updatedRole = await select('roles', { id: roleId });
      const permissions = await select('role_permissions', { role_id: roleId });
      const caps = permissions.map(p => p.permission_name);
      const roleConfig = updatedRole[0].config || {};

      // Normalize vendor types for response
      const normalizedVendorTypes = Array.isArray(roleConfig.vendorTypes) 
        ? roleConfig.vendorTypes.map((vt: string) => {
            const mapping: Record<string, string> = {
              'healthcare_provider': 'Healthcare Provider',
              'service_provider': 'Service Provider',
              'solo_provider': 'Service Provider',
              'center': 'Healthcare Provider',
              'organization': 'organization',
              'seller': 'Seller',
              'business': 'Business',
              'ngo': 'NGO',
            };
            return mapping[vt] || vt;
          })
        : [];

      // Phase 1: Return canonical codes only; labels separate (same as GetRoleByIdHandler)
      // Use distinct var name to avoid TDZ: body.serviceStyles shadows until we compute canonical
      const canonicalServiceStyles = getCanonicalServiceStyles(roleConfig);
      const serviceStylesLabels = Object.fromEntries(
        canonicalServiceStyles.map((c) => [c, LABEL_BY_CODE[c] || c])
      );

      return this.success({
        success: true,
        message: 'Role updated successfully',
        role: {
          ...updatedRole[0],
          roleId: updatedRole[0].id,
          roleName: updatedRole[0].display_name || updatedRole[0].name,
          roleCode: updatedRole[0].name,
          vendorTypes: normalizedVendorTypes,
          serviceStyles: canonicalServiceStyles,
          serviceStylesLabels,
          pricingControl: roleConfig.pricingControl || {
            canControlPrice: false,
            canControlDuration: false,
          },
          capabilities: caps,
          isActive: updatedRole[0].is_active !== false,
          updated_at: (updatedRole[0] as any).updated_at || null,
        },
      });
    } catch (error: any) {
      console.error('Error updating role:', error);
      return this.error(error.message || 'Failed to update role', 500);
    }
  }
}

class DeleteRoleHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const roleId = context.event.pathParameters?.roleId;
    const queryParams = context.event.queryStringParameters || {};
    const permanent = queryParams.permanent === 'true';

    if (!roleId) {
      return this.error('Role ID is required', 400);
    }

    // Check if role exists
    const roles = await select('roles', { id: roleId });
    if (roles.length === 0) {
      return this.error('Role not found', 404);
    }

    const role = roles[0];

    // Prevent deletion of system roles
    if (role.is_system_role) {
      return this.error('Cannot delete system roles. System roles are protected.', 403);
    }

    try {
      if (permanent) {
        // HARD DELETE: Permanently remove the role and its permissions
        // First check if any vendors are using this role
        const vendorsUsingRole = await query(
          `SELECT COUNT(*) as count FROM vendors WHERE role_id = $1 OR role = $2`,
          [roleId, role.name]
        );
        
        const vendorCount = parseInt(vendorsUsingRole.rows[0]?.count || '0', 10);
        if (vendorCount > 0) {
          return this.error(
            `Cannot permanently delete this role. ${vendorCount} vendor(s) are currently using it. Please reassign them first or use soft delete.`,
            400
          );
        }

        // Delete role permissions first (due to foreign key constraint)
        await query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);
        
        // Delete the role
        await query('DELETE FROM roles WHERE id = $1', [roleId]);

        console.log(`[Roles] Role permanently deleted: ${role.name} (${roleId})`);

        return this.success({
          message: 'Role permanently deleted',
          roleName: role.display_name || role.name,
          deleteType: 'permanent',
        });
      } else {
        // SOFT DELETE: Deactivate instead of deleting
        await update('roles', { id: roleId }, { is_active: false });

        console.log(`[Roles] Role deactivated: ${role.name} (${roleId})`);

        return this.success({
          message: 'Role deactivated successfully',
          roleName: role.display_name || role.name,
          deleteType: 'soft',
        });
      }
    } catch (error: any) {
      console.error('Error deleting role:', error);
      return this.error(error.message || 'Failed to delete role', 500);
    }
  }
}

/** Admin portal sections — derived from shared admin-portal-nav (sidebar = RBAC catalog). */
class GetAdminCapabilitiesHandler extends BaseHandler {
  async handle(_context: HandlerContext): Promise<HandlerResponse> {
    const capabilities = getAdminPortalCapabilitiesApiPayload();
    return this.success({
      success: true,
      capabilities,
      total: capabilities.length,
    });
  }
}

class GetCapabilitiesHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    // Return ALL 45 capabilities as defined in the platform
    // This ensures roles can be configured with any combination of capabilities
    const capabilities = [
      // ============================================================================
      // CORE OPERATIONS (6 capabilities)
      // ============================================================================
      { id: 'dashboard', name: 'Dashboard', category: 'Core Operations', description: 'Dashboard overview and stats' },
      { id: 'bookings', name: 'Bookings', category: 'Core Operations', description: 'Manage appointments and bookings' },
      { id: 'services', name: 'Services', category: 'Core Operations', description: 'Manage services catalog' },
      { id: 'staff', name: 'Staff Management', category: 'Core Operations', description: 'Manage team members' },
      { id: 'schedule', name: 'Schedule', category: 'Core Operations', description: 'Manage availability and schedules' },
      { id: 'profile', name: 'Profile', category: 'Core Operations', description: 'Update vendor profile' },
      
      // ============================================================================
      // FINANCE & PAYMENTS (4 capabilities)
      // ============================================================================
      { id: 'earnings', name: 'Earnings', category: 'Finance & Payments', description: 'View earnings and revenue' },
      { id: 'settlements', name: 'Settlements', category: 'Finance & Payments', description: 'View payouts and settlements' },
      { id: 'bank_account', name: 'Bank Account', category: 'Finance & Payments', description: 'Manage bank details' },
      { id: 'pricing', name: 'Pricing', category: 'Finance & Payments', description: 'Manage service pricing' },
      
      // ============================================================================
      // COMMUNICATION (3 capabilities)
      // ============================================================================
      { id: 'chat', name: 'Chat', category: 'Communication', description: 'Messages and chat with customers' },
      { id: 'notifications', name: 'Notifications', category: 'Communication', description: 'Send and manage notifications' },
      { id: 'video_calling', name: 'Video Calling', category: 'Communication', description: 'Video consultations and calls' },
      
      // ============================================================================
      // HEALTHCARE (4 capabilities)
      // ============================================================================
      { id: 'prescriptions', name: 'Prescriptions', category: 'Healthcare', description: 'Create and manage prescriptions (Vet, Nutritionist)' },
      { id: 'medical_records', name: 'Medical Records', category: 'Healthcare', description: 'Access and manage medical records (Vet)' },
      { id: 'diagnostics', name: 'Diagnostics', category: 'Healthcare', description: 'Diagnostic tests and results (Diagnostic centre)' },
      { id: 'pharmacy', name: 'Pharmacy', category: 'Healthcare', description: 'Pharmacy management and inventory (Pharmacy)' },
      
      // ============================================================================
      // SPECIALIZED SERVICES (8 capabilities)
      // ============================================================================
      { id: 'ambulance', name: 'Ambulance', category: 'Specialized Services', description: 'Ambulance vehicles and services (Ambulance service)' },
      { id: 'cafe_tables', name: 'Cafe Tables', category: 'Specialized Services', description: 'Cafe table management (Pet cafe)' },
      { id: 'table_management', name: 'Table Management', category: 'Specialized Services', description: 'Manage tables, seating, and reservations' },
      { id: 'rooms', name: 'Rooms', category: 'Specialized Services', description: 'Resort/boarding rooms management (Resort/boarding)' },
      { id: 'room_management', name: 'Room Management', category: 'Specialized Services', description: 'Manage rooms, occupancy, and bookings' },
      { id: 'insurance_plans', name: 'Insurance Plans', category: 'Specialized Services', description: 'Insurance plans and policies (Insurance provider)' },
      { id: 'pet_profiles', name: 'Pet Profiles', category: 'Specialized Services', description: 'Pet profiles for adoption (Breeder/NGO/Shelter)' },
      { id: 'meal_plans', name: 'Meal Plans', category: 'Specialized Services', description: 'Meal plans and diet charts (Nutritionist)' },
      { id: 'training_programs', name: 'Training Programs', category: 'Specialized Services', description: 'Training programs and sessions (Trainer)' },
      { id: 'walking', name: 'Walking', category: 'Specialized Services', description: 'Walking services and routes (Pet walker)' },
      
      // ============================================================================
      // OPERATIONS (6 capabilities)
      // ============================================================================
      { id: 'inventory', name: 'Inventory', category: 'Operations', description: 'Inventory management and stock control' },
      { id: 'orders', name: 'Orders', category: 'Operations', description: 'Order management and processing' },
      { id: 'delivery', name: 'Delivery', category: 'Operations', description: 'Delivery tracking and management' },
      { id: 'gps_tracking', name: 'GPS Tracking', category: 'Operations', description: 'GPS tracking for services and deliveries' },
      { id: 'reports', name: 'Reports', category: 'Operations', description: 'Reports and analytics' },
      { id: 'settings', name: 'Settings', category: 'Operations', description: 'Vendor settings and configuration' },
      
      // ============================================================================
      // ADVANCED FEATURES (8 capabilities)
      // ============================================================================
      { id: 'packages', name: 'Packages', category: 'Advanced Features', description: 'Package management and bundles' },
      { id: 'subscriptions', name: 'Subscriptions', category: 'Advanced Features', description: 'Subscription management' },
      { id: 'coupons', name: 'Coupons', category: 'Advanced Features', description: 'Coupon management and discounts' },
      { id: 'promotions', name: 'Promotions', category: 'Advanced Features', description: 'Promotions and marketing campaigns' },
      { id: 'reviews', name: 'Reviews', category: 'Advanced Features', description: 'Review management and responses' },
      { id: 'analytics', name: 'Analytics', category: 'Advanced Features', description: 'Analytics dashboard and insights' },
      { id: 'export', name: 'Export', category: 'Advanced Features', description: 'Data export functionality' },
      { id: 'integrations', name: 'Integrations', category: 'Advanced Features', description: 'Third-party integrations' },
      
      // ============================================================================
      // ADDITIONAL SPECIALIZED CAPABILITIES (from role-seeding.ts)
      // ============================================================================
      { id: 'tele', name: 'Tele Consultation', category: 'Communication', description: 'Telephone consultations' },
      { id: 'emergency', name: 'Emergency Services', category: 'Healthcare', description: 'Emergency protocols and services' },
      { id: 'emergency_protocols', name: 'Emergency Protocols', category: 'Healthcare', description: 'Emergency response protocols' },
      { id: 'ambulance_services', name: 'Ambulance Services', category: 'Healthcare', description: 'Ambulance and emergency transport' },
      { id: 'diagnostic_lab', name: 'Diagnostic Lab', category: 'Healthcare', description: 'Diagnostic laboratory services' },
      { id: 'patient_monitoring', name: 'Patient Monitoring', category: 'Healthcare', description: 'Patient monitoring and tracking' },
      { id: 'vet_summary', name: 'Vet Summary', category: 'Healthcare', description: 'Veterinary summary and reports' },
      { id: 'prescription_verification', name: 'Prescription Verification', category: 'Healthcare', description: 'Verify and validate prescriptions' },
      { id: 'controlled_substances', name: 'Controlled Substances', category: 'Healthcare', description: 'Manage controlled substances' },
      { id: 'catalog', name: 'Catalog', category: 'Operations', description: 'Product and service catalog management' },
      { id: 'expiry_management', name: 'Expiry Management', category: 'Operations', description: 'Manage product expiry dates' },
      { id: 'photo_updates', name: 'Photo Updates', category: 'Media', description: 'Photo updates and sharing' },
      { id: 'gallery', name: 'Gallery', category: 'Media', description: 'Photo gallery management' },
      { id: 'portfolio', name: 'Portfolio', category: 'Media', description: 'Portfolio showcase' },
      { id: 'progress_tracking', name: 'Progress Tracking', category: 'Media', description: 'Track progress with photos/videos' },
      { id: 'cctv_access', name: 'CCTV Access', category: 'Media', description: 'Access CCTV feeds' },
      { id: 'distance_pricing', name: 'Distance Pricing', category: 'Operations', description: 'Pricing based on distance' },
      { id: 'staff_management', name: 'Staff Management', category: 'Core Operations', description: 'Comprehensive staff management' },
      { id: 'schedule_management', name: 'Schedule Management', category: 'Core Operations', description: 'Advanced schedule management' },
      { id: 'facility_management', name: 'Facility Management', category: 'Operations', description: 'Facility and location management' },
      { id: 'multi_doctor_management', name: 'Multi-Doctor Management', category: 'Healthcare', description: 'Manage multiple doctors/staff' },
      { id: 'custom_services', name: 'Custom Services', category: 'Operations', description: 'Create and manage custom services' },
      { id: 'package_management', name: 'Package Management', category: 'Advanced Features', description: 'Package and bundle management' },
      { id: 'pax_management', name: 'PAX Management', category: 'Specialized Services', description: 'Manage party size and capacity' },
      { id: 'occupancy_tracking', name: 'Occupancy Tracking', category: 'Specialized Services', description: 'Track room/table occupancy' },
      { id: 'nightly_pricing', name: 'Nightly Pricing', category: 'Specialized Services', description: 'Nightly rates for rooms' },
      { id: 'menu', name: 'Menu', category: 'Specialized Services', description: 'Menu management for cafes/restaurants' },
      { id: 'diet_charts', name: 'Diet Charts', category: 'Specialized Services', description: 'Diet charts and meal planning' },
      { id: 'counseling', name: 'Counseling', category: 'Specialized Services', description: 'Counseling services' },
      { id: 'adoption', name: 'Adoption', category: 'Specialized Services', description: 'Pet adoption management' },
      { id: 'donation', name: 'Donation', category: 'Specialized Services', description: 'Donation management' },
      { id: 'events', name: 'Events', category: 'Specialized Services', description: 'Event management' },
      { id: 'memorial', name: 'Memorial', category: 'Specialized Services', description: 'Memorial services' },
      { id: 'claims_management', name: 'Claims Management', category: 'Specialized Services', description: 'Insurance claims management' },
      { id: 'policy_management', name: 'Policy Management', category: 'Specialized Services', description: 'Insurance policy management' },
      
      // ============================================================================
      // VERIFICATION & COMPLIANCE (Required for ALL vendors)
      // ============================================================================
      { id: 'bank_verification', name: 'Bank Verification', category: 'Verification & Compliance', description: 'Bank account verification via Razorpay Marketplace API' },
      { id: 'location_verification', name: 'Location Verification', category: 'Verification & Compliance', description: 'Google location/address verification for vendor profile' },
      { id: 'address_verification', name: 'Address Verification', category: 'Verification & Compliance', description: 'Verify vendor address using Google Maps API' },
      { id: 'live_location', name: 'Live Location', category: 'Operations', description: 'Real-time location tracking for home/mobile services' },
      { id: 'kyc_verification', name: 'KYC Verification', category: 'Verification & Compliance', description: 'Know Your Customer verification for vendors' },
      
      // ============================================================================
      // PHARMACY & DELIVERY SPECIFIC
      // ============================================================================
      { id: 'order_dispatch', name: 'Order Dispatch', category: 'Pharmacy', description: 'Receive and dispatch orders from nearby customers (Uber-like)' },
      { id: 'availability_check', name: 'Availability Check', category: 'Pharmacy', description: 'Confirm medicine/product availability before accepting order' },
      { id: 'invoice_generation', name: 'Invoice Generation', category: 'Finance & Payments', description: 'Generate proforma and final invoices' },
      { id: 'delivery_partner', name: 'Delivery Partner', category: 'Delivery', description: 'Integration with delivery partners for order fulfillment' },
      { id: 'eta_tracking', name: 'ETA Tracking', category: 'Delivery', description: 'Real-time ETA calculation and tracking' },
      { id: 'cod_payment', name: 'COD Payment', category: 'Finance & Payments', description: 'Accept Cash on Delivery payments' },
      { id: 'online_payment', name: 'Online Payment', category: 'Finance & Payments', description: 'Accept online payments via Razorpay' },
      { id: 'order_broadcast', name: 'Order Broadcast', category: 'Pharmacy', description: 'Receive order broadcasts from nearby customers' },
      { id: 'radius_service', name: 'Radius Service', category: 'Operations', description: 'Define service radius for order acceptance' },
    ];

    return this.success({
      success: true,
      capabilities,
      total: capabilities.length,
    });
  }
}

// ============================================================================
// HONO ROUTER SETUP
// ============================================================================

export function registerRoleEndpoints(app: Hono) {
  const getRolesHandler = new GetRolesHandler();
  const getRoleByIdHandler = new GetRoleByIdHandler();
  const createRoleHandler = new CreateRoleHandler();
  const updateRoleHandler = new UpdateRoleHandler();
  const deleteRoleHandler = new DeleteRoleHandler();
  const getCapabilitiesHandler = new GetCapabilitiesHandler();
  const getAdminCapabilitiesHandler = new GetAdminCapabilitiesHandler();

  // GET endpoints
  app.get('/config/roles', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await getRolesHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // All available customer services - used as default for all roles
  // These represent the services shown in the customer app
  const ALL_CUSTOMER_SERVICES = [
    { id: 'vet', label: 'Vet Care', icon: '🩺', enabled: true, serviceId: 'vet', launchPhase: 'full', rolloutPercentage: 100 },
    { id: 'grooming', label: 'Grooming', icon: '✂️', enabled: true, serviceId: 'grooming', launchPhase: 'full', rolloutPercentage: 100 },
    { id: 'shop', label: 'Shop', icon: '🛍️', enabled: true, serviceId: 'shop', launchPhase: 'full', rolloutPercentage: 100 },
    { id: 'training', label: 'Training', icon: '🎓', enabled: true, serviceId: 'training', launchPhase: 'full', rolloutPercentage: 100 },
    { id: 'walker', label: 'Walker', icon: '🚶', enabled: true, serviceId: 'walker', launchPhase: 'full', rolloutPercentage: 100 },
    { id: 'boarding', label: 'Boarding', icon: '🏠', enabled: true, serviceId: 'boarding', launchPhase: 'full', rolloutPercentage: 100 },
    { id: 'adoption', label: 'Adoption', icon: '❤️', enabled: true, serviceId: 'adoption', launchPhase: 'full', rolloutPercentage: 100 },
    { id: 'mating', label: 'Peer to Peer', icon: '💕', enabled: true, serviceId: 'mating-dating-hub', launchPhase: 'full', rolloutPercentage: 100 },
    { id: 'cafes', label: 'Pet Cafes', icon: '☕', enabled: true, serviceId: 'cafes', launchPhase: 'full', rolloutPercentage: 100 },
    { id: 'photography', label: 'Photography', icon: '📷', enabled: true, serviceId: 'photography', launchPhase: 'full', rolloutPercentage: 100 },
    { id: 'insurance', label: 'Insurance', icon: '🛡️', enabled: true, serviceId: 'insurance', launchPhase: 'full', rolloutPercentage: 100 },
    { id: 'breeder', label: 'Breeder', icon: '🐕', enabled: true, serviceId: 'breeder', launchPhase: 'full', rolloutPercentage: 100 },
    { id: 'ambulance', label: 'Ambulance', icon: '🚑', enabled: true, serviceId: 'ambulance', launchPhase: 'full', rolloutPercentage: 100 },
    { id: 'nutritionist', label: 'Nutritionist', icon: '🥗', enabled: true, serviceId: 'nutritionist', launchPhase: 'full', rolloutPercentage: 100 },
    { id: 'relocation', label: 'Relocation', icon: '✈️', enabled: true, serviceId: 'relocation', launchPhase: 'full', rolloutPercentage: 100 },
    { id: 'resort', label: 'Pet Resort', icon: '🏖️', enabled: true, serviceId: 'resort', launchPhase: 'full', rolloutPercentage: 100 },
    { id: 'holiday', label: 'Pet Holiday', icon: '🌴', enabled: true, serviceId: 'holiday', launchPhase: 'full', rolloutPercentage: 100 },
    { id: 'sunset', label: 'Sunset Care', icon: '🌅', enabled: true, serviceId: 'sunset', launchPhase: 'full', rolloutPercentage: 100 },
  ];

  // Default dashboard buttons by role - returns ALL customer services
  // The Dashboard UI tab allows admins to enable/disable specific services per role
  function getDefaultButtonsForRole(roleId: string): any[] {
    // For all roles, return ALL customer services enabled by default
    // Admins can then disable specific services via the Dashboard UI tab
    return [...ALL_CUSTOMER_SERVICES];
  }

  app.get('/config/ui/dashboard', async (c) => {
    try {
      const roleId = c.req.query('roleId');
      
      if (!roleId) {
        return c.json({ error: 'roleId is required' }, 400);
      }

      const settings = await select('platform_settings', { 
        setting_key: `platform:ui:dashboard:${roleId}` 
      });

      let dashboardConfig: any;

      if (settings.length > 0) {
        dashboardConfig = settings[0].setting_value as any;
        
        // Ensure buttons/widgets array exists
        if (!dashboardConfig.buttons && !dashboardConfig.widgets) {
          dashboardConfig.buttons = getDefaultButtonsForRole(roleId);
        } else if (dashboardConfig.widgets && dashboardConfig.widgets.length === 0) {
          // If widgets is empty, use defaults
          dashboardConfig.buttons = getDefaultButtonsForRole(roleId);
        } else if (dashboardConfig.widgets && !dashboardConfig.buttons) {
          // Convert widgets to buttons
          dashboardConfig.buttons = dashboardConfig.widgets;
        }
      } else {
        // No config exists, return defaults
        dashboardConfig = {
          buttons: getDefaultButtonsForRole(roleId),
          widgets: getDefaultButtonsForRole(roleId),
          layout: 'default',
          theme: 'light',
        };
      }

      return c.json({
        success: true,
        config: dashboardConfig,
        roleId,
      });
    } catch (error: any) {
      console.error('Error fetching dashboard config:', error);
      // Return defaults on error
      const roleId = c.req.query('roleId') || 'veterinarian';
      return c.json({ 
        success: true, 
        config: { 
          buttons: getDefaultButtonsForRole(roleId as string),
          widgets: getDefaultButtonsForRole(roleId as string),
          layout: 'default', 
          theme: 'light' 
        } 
      });
    }
  });

  app.put('/config/ui/dashboard', async (c) => {
    try {
      const body = await c.req.json();
      const { roleId, config } = body;

      if (!roleId) {
        return c.json({ error: 'roleId is required' }, 400);
      }

      // Handle both array (buttons) and object (full config) formats
      let configToSave: any;
      
      if (Array.isArray(config)) {
        // If config is an array, wrap it in buttons property
        configToSave = {
          buttons: config,
          widgets: config, // Keep widgets for backward compatibility
          layout: 'default',
          theme: 'light',
        };
      } else if (config && typeof config === 'object') {
        // If config is an object, use it as-is but ensure buttons/widgets exist
        configToSave = {
          ...config,
          buttons: config.buttons || config.widgets || [],
          widgets: config.widgets || config.buttons || [],
        };
      } else {
        return c.json({ error: 'Invalid config format' }, 400);
      }

      // Check if config exists
      const existing = await select('platform_settings', {
        setting_key: `platform:ui:dashboard:${roleId}`
      });

      if (existing.length > 0) {
        // Update existing
        await update(
          'platform_settings',
          { setting_key: `platform:ui:dashboard:${roleId}` },
          {
            setting_value: configToSave,
            setting_type: 'object',  // Must be one of: string, number, boolean, object, array
            description: `Dashboard UI configuration for role ${roleId}`,
            updated_at: new Date().toISOString(),
          }
        );
      } else {
        // Insert new
        await insert('platform_settings', {
          setting_key: `platform:ui:dashboard:${roleId}`,
          setting_value: configToSave,
          setting_type: 'object',  // Must be one of: string, number, boolean, object, array
          description: `Dashboard UI configuration for role ${roleId}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }

      return c.json({
        success: true,
        message: 'Dashboard configuration updated',
        config: configToSave,
      });
    } catch (error: any) {
      console.error('Error updating dashboard config:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  app.get('/config/roles/:roleId', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { roleId: c.req.param('roleId') };
    const context = createLambdaContext();
    const result = await getRoleByIdHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Admin endpoints for role management
  app.get('/roles', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await getRolesHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.get('/admin/roles', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await getRolesHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.get('/admin/capabilities', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await getCapabilitiesHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.get('/admin/admin-capabilities', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await getAdminCapabilitiesHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.post('/admin/roles', async (c) => {
    const event = await createApiGatewayEventWithBody(c);
    const context = createLambdaContext();
    const result = await createRoleHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.put('/admin/roles/:roleId', async (c) => {
    const event = await createApiGatewayEventWithBody(c);
    event.pathParameters = { roleId: c.req.param('roleId') };
    const context = createLambdaContext();
    const result = await updateRoleHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.delete('/admin/roles/:roleId', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { roleId: c.req.param('roleId') };
    const context = createLambdaContext();
    const result = await deleteRoleHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });
}

/**
 * Hono `req.url` may be a full URL or only `path?query`. Node's `new URL('/path?q=1')` throws;
 * use URLSearchParams on the query slice so `active=false` and `role_type=admin` always parse.
 */
function queryStringParametersFromRequestUrl(rawUrl: string): Record<string, string> {
  if (!rawUrl || typeof rawUrl !== 'string') return {};
  const noHash = rawUrl.split('#')[0] ?? rawUrl;
  const q = noHash.indexOf('?');
  if (q === -1) return {};
  return Object.fromEntries(new URLSearchParams(noHash.slice(q + 1)));
}

function createApiGatewayEvent(req: any): any {
  return {
    httpMethod: req.method,
    path: req.url,
    headers: req.headers,
    body: JSON.stringify(req.body || {}),
    pathParameters: req.param() || {},
    queryStringParameters: queryStringParametersFromRequestUrl(String(req.url || '')),
    requestContext: {
      requestId: randomUUID(),
    },
  };
}

async function createApiGatewayEventWithBody(c: any): Promise<any> {
  const body = await c.req.json();
  return {
    httpMethod: c.req.method,
    path: c.req.url,
    headers: Object.fromEntries(c.req.raw.headers.entries()),
    body: JSON.stringify(body),
    pathParameters: {},
    queryStringParameters: {},
    requestContext: {
      requestId: randomUUID(),
    },
  };
}

function createLambdaContext(): any {
  return {
    requestId: randomUUID(),
    functionName: 'role-handler',
    functionVersion: '$LATEST',
  };
}

