import type { Context, MiddlewareHandler, Next } from 'hono';
import { resolveAdminPermissionsFromRequest } from '../../../admin/admin-resolve-permissions-from-request';
import {
  hasInsuranceAdminPermission,
  type InsuranceAdminPermissionId,
} from '../authorization/permissions';

export const INSURANCE_ADMIN_ID_CONTEXT_KEY = 'insuranceAdminUserId';

function resolveAdminUserId(c: Context): string | null {
  const userId = c.get('userId');
  return typeof userId === 'string' && userId.length > 0 ? userId : null;
}

/** Admin user id set by requireInsuranceAdminPermission. */
export function insuranceAdminActorId(c: Context): string | null {
  const id = c.get(INSURANCE_ADMIN_ID_CONTEXT_KEY);
  return typeof id === 'string' && id.length > 0 ? id : resolveAdminUserId(c);
}

export function requireInsuranceAdminPermission(
  permission: InsuranceAdminPermissionId,
): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    const adminUserId = resolveAdminUserId(c);
    if (!adminUserId) {
      return c.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        401,
      );
    }
    const permissions = await resolveAdminPermissionsFromRequest(
      adminUserId,
      c.req.header('Authorization'),
    );
    if (!hasInsuranceAdminPermission(permissions, permission)) {
      return c.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        403,
      );
    }
    c.set(INSURANCE_ADMIN_ID_CONTEXT_KEY, adminUserId);
    await next();
  };
}
