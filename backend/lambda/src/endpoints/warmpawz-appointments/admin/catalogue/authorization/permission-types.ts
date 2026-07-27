/** Hono context key for a pre-built authenticated admin payload. */
export const AUTHENTICATED_ADMIN_CONTEXT_KEY = 'authenticatedAdmin';

/** Hono context key for the authenticated admin user id. */
export const ADMIN_USER_ID_CONTEXT_KEY = 'adminUserId';

/** Hono context key for resolved admin permission strings. */
export const ADMIN_PERMISSIONS_CONTEXT_KEY = 'adminPermissions';

export interface AuthenticatedAdmin {
  readonly adminUserId: string;
  readonly permissions: readonly string[];
}
