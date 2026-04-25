/**
 * Resolve admin portal permission strings from JWT principal + optional Bearer header.
 * Shared by proactive alerts snapshot and admin AI copilot.
 */
import { query } from '../../database/rds-connection';
import { resolveAdminPermissions } from '../../utils/admin-rbac-permissions';

export const UAT_SYNTHETIC_ADMIN_USER_ID = 'uat-admin-user';

export async function resolveAdminPermissionsFromRequest(
  userId: string | undefined,
  authHeader: string | undefined
): Promise<string[]> {
  if (!userId) return [];
  if (userId === UAT_SYNTHETIC_ADMIN_USER_ID) {
    return ['admin.full_access'];
  }

  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRe.test(userId)) {
    const r = await query('SELECT id, email, role FROM admins WHERE id = $1::uuid LIMIT 1', [userId]);
    if (r.rows?.length) {
      const row = r.rows[0] as { id: string; email?: string; role?: string };
      return resolveAdminPermissions(String(row.id), row.role, row.email);
    }
  }

  if (authHeader && /^Bearer\s+/i.test(authHeader)) {
    try {
      const { extractAndVerifyAuthToken } = await import('../../utils/jwt-verification');
      const result = await extractAndVerifyAuthToken({ authorization: authHeader });
      if (result.valid && result.payload) {
        const p = result.payload as Record<string, unknown>;
        let email: string | null = null;
        if (typeof p.email === 'string' && p.email.trim()) {
          email = p.email.trim();
        } else {
          const un = String(p['cognito:username'] || '');
          email = un.startsWith('phone_') ? un.slice('phone_'.length).trim() || null : un.trim() || null;
        }
        if (email) {
          const r2 = await query('SELECT id, email, role FROM admins WHERE LOWER(email) = LOWER($1) LIMIT 1', [
            email,
          ]);
          if (r2.rows?.length) {
            const row = r2.rows[0] as { id: string; email?: string; role?: string };
            return resolveAdminPermissions(String(row.id), row.role, row.email);
          }
        }
      }
    } catch {
      /* ignore */
    }
  }

  return [];
}
