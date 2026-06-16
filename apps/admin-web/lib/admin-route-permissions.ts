/**
 * Maps URL path prefixes to required admin portal permissions.
 * Derived from @warmpawz/shared-types/admin-portal-nav (single source of truth).
 */

export type AdminRouteGateRule = {
  pathPrefix: string;
  permission: string | string[];
  hint?: string;
};

export {
  getAdminPortalRouteGateRule as getAdminRouteGateRule,
  formatAdminRouteRequiredPermissions as formatRequiredPermissions,
} from '@warmpawz/shared-types';
