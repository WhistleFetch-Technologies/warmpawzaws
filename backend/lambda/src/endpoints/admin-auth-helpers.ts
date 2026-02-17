/**
 * ============================================================================
 * ADMIN AUTH HELPERS — Permission resolution, requirePermission, logAdminAction
 * ============================================================================
 * Production-grade: used by all admin routes after requireAdminAuth.
 * ============================================================================
 */

import { query, select } from '../database/rds-connection';

export interface AdminIdentity {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  role: string;
  admin_role_id: string | null;
  is_active: boolean;
}

const ADMIN_CONTEXT_KEY = 'adminIdentity';
const ADMIN_PERMISSIONS_KEY = 'adminPermissions';

/**
 * Resolve admin record by id (JWT sub from admin login) or by email.
 * Returns null if not found or inactive.
 */
export async function resolveAdminByIdOrEmail(adminId: string, email?: string): Promise<AdminIdentity | null> {
  try {
    const byId = await query(
      `SELECT id, email, name, phone, role, admin_role_id, is_active
       FROM admins WHERE id = $1 LIMIT 1`,
      [adminId]
    );
    if (byId.rows?.length) {
      const row = byId.rows[0];
      if (row.is_active === false) return null;
      return {
        id: row.id,
        email: row.email,
        name: row.name ?? row.email,
        phone: row.phone ?? null,
        role: row.role ?? 'admin',
        admin_role_id: row.admin_role_id ?? null,
        is_active: row.is_active !== false,
      };
    }
    if (email) {
      const byEmail = await query(
        `SELECT id, email, name, phone, role, admin_role_id, is_active
         FROM admins WHERE email = $1 LIMIT 1`,
        [email]
      );
      if (byEmail.rows?.length) {
        const row = byEmail.rows[0];
        if (row.is_active === false) return null;
        return {
          id: row.id,
          email: row.email,
          name: row.name ?? row.email,
          phone: row.phone ?? null,
          role: row.role ?? 'admin',
          admin_role_id: row.admin_role_id ?? null,
          is_active: row.is_active !== false,
        };
      }
    }
  } catch (e) {
    console.warn('[ADMIN AUTH HELPERS] resolveAdminByIdOrEmail error:', (e as Error)?.message);
  }
  return null;
}

/**
 * Load permission codes for an admin role from role_permissions.
 * If admin_role_id is null, returns empty array (no permissions) or optionally full access for legacy.
 */
export async function resolveAdminPermissions(adminRoleId: string | null): Promise<string[]> {
  if (!adminRoleId) return [];
  try {
    const result = await query(
      `SELECT permission_name FROM role_permissions WHERE role_id = $1`,
      [adminRoleId]
    );
    return (result.rows || []).map((r: any) => String(r.permission_name)).filter(Boolean);
  } catch (e) {
    console.warn('[ADMIN AUTH HELPERS] resolveAdminPermissions error:', (e as Error)?.message);
    return [];
  }
}

/**
 * Set admin identity and permissions on Hono context.
 * Uses generic context type so any Hono app can use it.
 */
export function setAdminContext(c: any, admin: AdminIdentity, permissions: string[]): void {
  if (typeof c.set === 'function') {
    c.set(ADMIN_CONTEXT_KEY, admin);
    c.set(ADMIN_PERMISSIONS_KEY, permissions);
  }
}

export function getAdminIdentity(c: any): AdminIdentity | null {
  if (typeof c.get === 'function') return c.get(ADMIN_CONTEXT_KEY) ?? null;
  return null;
}

export function getAdminPermissions(c: any): string[] {
  if (typeof c.get === 'function') return c.get(ADMIN_PERMISSIONS_KEY) ?? [];
  return [];
}

/** All admin permission codes (for Super Admin / UAT fallback) */
export const FULL_ADMIN_PERMISSIONS = [
  'admin:analytics:view', 'admin:enterprise:view', 'admin:enterprise:edit',
  'admin:vendors:view', 'admin:vendors:approve', 'admin:vendors:reject',
  'admin:ecommerce:view', 'admin:ecommerce:edit', 'admin:regions:view', 'admin:regions:edit',
  'admin:marketing:view', 'admin:marketing:edit', 'admin:loyalty:view', 'admin:loyalty:edit',
  'admin:support:view', 'admin:support:edit', 'admin:catalog:view', 'admin:catalog:edit',
  'admin:finance:view', 'admin:finance:edit', 'admin:roles:view', 'admin:roles:edit',
  'admin:users:view', 'admin:users:create', 'admin:users:edit', 'admin:users:reset_password',
  'admin:platform_settings:view', 'admin:platform_settings:edit', 'admin:reports:view',
  'admin:audit:view', 'admin:events:view', 'admin:events:edit', 'admin:content:view', 'admin:content:edit',
  'admin:pet_info:view', 'admin:pet_info:edit',
];

/** Set synthetic admin context for UAT mode (full permissions) */
export function setUatAdminContext(c: any): void {
  const synthetic: AdminIdentity = {
    id: 'uat-admin-user',
    email: 'uat@warmpawz.com',
    name: 'UAT Admin',
    phone: null,
    role: 'super-admin',
    admin_role_id: null,
    is_active: true,
  };
  setAdminContext(c, synthetic, FULL_ADMIN_PERMISSIONS);
}

/**
 * Attach admin identity and permissions to context after JWT verification.
 * Call with payload.sub (admin id) and optional payload.email.
 */
export async function attachAdminContext(c: any, userId: string, email?: string): Promise<AdminIdentity | null> {
  const admin = await resolveAdminByIdOrEmail(userId, email);
  if (!admin) return null;
  const permissions = await resolveAdminPermissions(admin.admin_role_id);
  setAdminContext(c, admin, permissions);
  return admin;
}

/**
 * Require a specific permission. Returns true if allowed, false otherwise.
 * Caller should return 403 if false.
 */
export function requirePermission(c: any, permissionCode: string): boolean {
  const permissions = getAdminPermissions(c);
  if (permissions.includes(permissionCode)) return true;
  // Super-admin legacy: if role is 'super-admin' string on identity, allow all (backward compat)
  const admin = getAdminIdentity(c);
  if (admin?.role === 'super-admin' && !admin.admin_role_id) return true;
  return false;
}

/**
 * Log an admin action to audit_logs (if table exists).
 * Never log passwords or OTPs in details.
 */
export async function logAdminAction(params: {
  action: string;
  performedBy: string;
  actorType?: string;
  resourceType?: string;
  resourceId?: string | null;
  section?: string;
  details?: Record<string, unknown>;
  status?: 'success' | 'failure';
}): Promise<void> {
  const {
    action,
    performedBy,
    actorType = 'admin',
    resourceType,
    resourceId,
    section,
    details = {},
    status = 'success',
  } = params;
  const safeDetails = section ? { ...details, section } : details;
  try {
    await query(
      `INSERT INTO audit_logs (action, performed_by, actor_type, resource_type, resource_id, details, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        action,
        performedBy,
        actorType,
        resourceType ?? null,
        resourceId ?? null,
        JSON.stringify(safeDetails),
        status,
      ]
    );
  } catch (e) {
    console.warn('[ADMIN AUDIT] logAdminAction failed (table may not exist):', (e as Error)?.message);
  }
}
