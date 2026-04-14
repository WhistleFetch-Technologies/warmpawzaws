/**
 * Admin portal RBAC: resolve permission strings from user_roles + role_permissions.
 * Master admin and super-admin always get admin.full_access.
 */
import { query } from '../database/rds-connection';

export const MASTER_ADMIN_ID = 'f0ed5fb7-7bfd-4080-a939-a6cd58e06017';

/** Primary production master account — always receives admin.full_access even if UUID or admins.role differ. */
export const DEFAULT_MASTER_ADMIN_EMAIL = 'admin@warmpawz.com';

function masterAdminEmailSet(): Set<string> {
  const set = new Set<string>();
  set.add(DEFAULT_MASTER_ADMIN_EMAIL.toLowerCase());
  const extra = (process.env.MASTER_ADMIN_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  for (const e of extra) set.add(e);
  return set;
}

export function isMasterAdminEmail(email: string | null | undefined): boolean {
  if (!email || typeof email !== 'string') return false;
  return masterAdminEmailSet().has(email.trim().toLowerCase());
}

/** Static list of admin-scoped capability IDs (must match GetAdminCapabilitiesHandler + migrations). */
export const ALL_ADMIN_PERMISSION_IDS = [
  'admin.dashboard',
  'admin.analytics',
  'admin.vendors',
  'admin.catalog',
  'admin.settlements',
  'admin.reports',
  'admin.integrations',
  'admin.governance',
  'admin.logistics',
  'admin.refunds',
  'admin.support',
  'admin.events',
  'admin.ecommerce',
  'admin.platform_settings',
  'admin.roles',
  'admin.full_access',
] as const;

export function hasAdminPermission(
  permissions: string[] | null | undefined,
  required: string
): boolean {
  if (!permissions || permissions.length === 0) return false;
  if (permissions.includes('admin.full_access')) return true;
  if (permissions.includes('*')) return true;
  return permissions.includes(required);
}

export async function resolveAdminPermissions(
  adminId: string,
  adminRole: string | null | undefined,
  adminEmail?: string | null
): Promise<string[]> {
  const role = (adminRole || '').toLowerCase();
  if (adminId === MASTER_ADMIN_ID || isMasterAdminEmail(adminEmail)) {
    return ['admin.full_access'];
  }
  if (role === 'super-admin' || role === 'super_admin' || role === 'superadmin') {
    return ['admin.full_access'];
  }

  try {
    const result = await query(
      `SELECT DISTINCT rp.permission_name
       FROM user_roles ur
       JOIN role_permissions rp ON ur.role_id = rp.role_id
       WHERE ur.user_id = $1::uuid AND ur.is_active = true`,
      [adminId]
    );
    const perms = (result.rows || [])
      .map((r: { permission_name: string }) => r.permission_name)
      .filter(Boolean);
    if (perms.includes('admin.full_access')) {
      return ['admin.full_access'];
    }
    const unique = [...new Set(perms)];
    if (unique.length > 0) {
      return unique;
    }
  } catch (e) {
    console.warn('[resolveAdminPermissions] query failed:', (e as Error).message);
  }

  // Legacy admins without user_roles rows: keep full access if broad admin role
  if (role === 'admin' || role === 'administrator' || role === 'master' || role === 'owner') {
    return ['admin.full_access'];
  }

  return [];
}

/** True if this admin may open RBAC UI / create users / assign roles (admin.roles or full). */
export async function canManageRbacAdmin(adminId: string | undefined): Promise<boolean> {
  if (!adminId || !isValidUuid(adminId)) return false;
  try {
    const r = await query('SELECT role, email FROM admins WHERE id = $1::uuid LIMIT 1', [adminId]);
    const role = r.rows[0]?.role as string | undefined;
    const email = r.rows[0]?.email as string | undefined;
    const perms = await resolveAdminPermissions(adminId, role, email);
    return hasAdminPermission(perms, 'admin.roles');
  } catch {
    return false;
  }
}

function isValidUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}
