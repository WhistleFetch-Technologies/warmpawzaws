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

/** Synthetic principal from auth-middleware when Bearer is uat-token-* (non-prod only). */
const UAT_SYNTHETIC_ADMIN_USER_ID = 'uat-admin-user';

/**
 * True when this Lambda deployment should be treated as production for UAT synthetic bypass.
 * Do not use NODE_ENV alone — many dev/stage Lambdas set NODE_ENV=production while STAGE is not prod.
 */
function isAwsProdLambdaForRbacBypass(): boolean {
  const stage = (process.env.STAGE || '').toLowerCase();
  if (stage === 'prod' || stage === 'production') return true;
  const fn = (process.env.AWS_LAMBDA_FUNCTION_NAME || '').toLowerCase();
  if (fn.includes('prod') && !fn.includes('dev') && !fn.includes('uat') && !fn.includes('staging')) {
    return true;
  }
  return false;
}

/**
 * True if this admin may open RBAC UI / create users / assign roles (admin.roles or full).
 * @param jwtEmailHint Optional email from JWT when `adminId` (e.g. Cognito `sub`) does not match `admins.id`.
 */
export async function canManageRbacAdmin(
  adminId: string | undefined,
  jwtEmailHint?: string | null
): Promise<boolean> {
  if (!adminId) return false;
  // Dev/UAT: middleware sets userId to uat-admin-user for uat-token-*; that string is not a UUID, so the
  // UUID branch below would always deny. Allow RBAC on non-prod Lambdas (see isAwsProdLambdaForRbacBypass).
  if (adminId === UAT_SYNTHETIC_ADMIN_USER_ID && !isAwsProdLambdaForRbacBypass()) {
    return true;
  }
  if (!isValidUuid(adminId) && adminId !== UAT_SYNTHETIC_ADMIN_USER_ID) return false;

  try {
    let row: { id: string; role?: string; email?: string } | null = null;

    if (isValidUuid(adminId)) {
      const r = await query('SELECT id, role, email FROM admins WHERE id = $1::uuid LIMIT 1', [adminId]);
      if (r.rows?.length) row = r.rows[0] as { id: string; role?: string; email?: string };
    }

    const hint = jwtEmailHint && String(jwtEmailHint).trim();
    if (!row && hint) {
      const r2 = await query(
        'SELECT id, role, email FROM admins WHERE LOWER(email) = LOWER($1) LIMIT 1',
        [hint]
      );
      if (r2.rows?.length) row = r2.rows[0] as { id: string; role?: string; email?: string };
    }

    if (!row) return false;

    const perms = await resolveAdminPermissions(String(row.id), row.role, row.email);
    return hasAdminPermission(perms, 'admin.roles');
  } catch {
    return false;
  }
}

function isValidUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}
