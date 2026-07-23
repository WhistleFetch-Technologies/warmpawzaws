import type { Context, MiddlewareHandler, Next } from 'hono';
import { CatalogueErrorCode, type CatalogueErrorResponse } from '../dto/catalogue.errors';
import { hasWpayCataloguePermission } from '../authorization/permissions';
import type { WpayCataloguePermissionId } from '../authorization/permissions';
import type { AuthenticatedAdmin } from '../authorization/permission-types';
import {
  ADMIN_PERMISSIONS_CONTEXT_KEY,
  ADMIN_USER_ID_CONTEXT_KEY,
  AUTHENTICATED_ADMIN_CONTEXT_KEY,
} from '../authorization/permission-types';

function readPermissionList(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === 'string');
}

function isAuthenticatedAdmin(value: unknown): value is AuthenticatedAdmin {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.adminUserId === 'string' &&
    record.adminUserId.length > 0 &&
    Array.isArray(record.permissions)
  );
}

export function getAuthenticatedAdmin(c: Context): AuthenticatedAdmin | null {
  const authenticated = c.get(AUTHENTICATED_ADMIN_CONTEXT_KEY);
  if (isAuthenticatedAdmin(authenticated)) {
    return {
      adminUserId: authenticated.adminUserId,
      permissions: readPermissionList(authenticated.permissions),
    };
  }

  const adminUserIdFromContext = c.get(ADMIN_USER_ID_CONTEXT_KEY);
  const userIdFromContext = c.get('userId');
  const adminUserId =
    typeof adminUserIdFromContext === 'string' && adminUserIdFromContext.length > 0
      ? adminUserIdFromContext
      : typeof userIdFromContext === 'string' && userIdFromContext.length > 0
        ? userIdFromContext
        : null;

  if (!adminUserId) {
    return null;
  }

  const permissions =
    readPermissionList(c.get(ADMIN_PERMISSIONS_CONTEXT_KEY)).length > 0
      ? readPermissionList(c.get(ADMIN_PERMISSIONS_CONTEXT_KEY))
      : readPermissionList(c.get('permissions'));

  return {
    adminUserId,
    permissions,
  };
}

export function getRequiredAdminUserId(c: Context): string {
  const admin = getAuthenticatedAdmin(c);
  if (!admin) {
    throw new Error('Authenticated admin context is required');
  }
  return admin.adminUserId;
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

export function requireAdminPermission(
  permission: WpayCataloguePermissionId,
): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    const admin = getAuthenticatedAdmin(c);
    if (!admin) {
      return unauthorizedResponse(c);
    }

    if (!hasWpayCataloguePermission(admin.permissions, permission)) {
      return forbiddenResponse(c);
    }

    await next();
  };
}
