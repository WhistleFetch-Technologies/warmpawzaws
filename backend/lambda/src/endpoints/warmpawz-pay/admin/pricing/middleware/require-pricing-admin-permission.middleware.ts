import type { Context, MiddlewareHandler, Next } from 'hono';
import { resolveAdminPermissionsFromRequest } from '../../../../admin/admin-resolve-permissions-from-request';
import { CatalogueErrorCode, type CatalogueErrorResponse } from '../../catalogue/dto/catalogue.errors';
import {
  ADMIN_PERMISSIONS_CONTEXT_KEY,
  ADMIN_USER_ID_CONTEXT_KEY,
  AUTHENTICATED_ADMIN_CONTEXT_KEY,
} from '../../catalogue/authorization/permission-types';
import {
  hasWpayPricingPermission,
  type WpayPricingPermissionId,
} from '../authorization/permissions';

function resolveAdminUserId(c: Context): string | null {
  const adminUserIdFromContext = c.get(ADMIN_USER_ID_CONTEXT_KEY);
  const userIdFromContext = c.get('userId');
  if (typeof adminUserIdFromContext === 'string' && adminUserIdFromContext.length > 0) {
    return adminUserIdFromContext;
  }
  if (typeof userIdFromContext === 'string' && userIdFromContext.length > 0) {
    return userIdFromContext;
  }
  return null;
}

function unauthorizedResponse(c: Context): Response {
  const body: CatalogueErrorResponse = {
    success: false,
    error: {
      code: CatalogueErrorCode.UNAUTHORIZED,
      message: 'Authentication required',
    },
  };
  return c.json(body, 401);
}

function forbiddenResponse(c: Context): Response {
  const body: CatalogueErrorResponse = {
    success: false,
    error: {
      code: CatalogueErrorCode.FORBIDDEN,
      message: 'Insufficient permissions',
    },
  };
  return c.json(body, 403);
}

export function requirePricingAdminPermission(
  permission: WpayPricingPermissionId,
): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    const adminUserId = resolveAdminUserId(c);
    if (!adminUserId) {
      return unauthorizedResponse(c);
    }

    const permissions = await resolveAdminPermissionsFromRequest(
      adminUserId,
      c.req.header('Authorization'),
    );

    c.set(ADMIN_USER_ID_CONTEXT_KEY, adminUserId);
    c.set(ADMIN_PERMISSIONS_CONTEXT_KEY, permissions);
    c.set(AUTHENTICATED_ADMIN_CONTEXT_KEY, {
      adminUserId,
      permissions,
    });

    if (!hasWpayPricingPermission(permissions, permission)) {
      return forbiddenResponse(c);
    }

    await next();
  };
}

export function getRequiredAdminUserId(c: Context): string {
  const adminUserId = resolveAdminUserId(c);
  if (!adminUserId) {
    throw new Error('Admin user id missing from context');
  }
  return adminUserId;
}
