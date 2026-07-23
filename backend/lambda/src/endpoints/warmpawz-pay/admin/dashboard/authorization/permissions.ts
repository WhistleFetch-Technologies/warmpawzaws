import { WPAY_LEGACY_FULL_ACCESS } from '../../catalogue/authorization/permissions';

/** Read-only Warmpawz Pay dashboard access. */
export const WPAY_DASHBOARD_VIEW = 'admin.warmpawz_pay.dashboard.view';

export type WpayDashboardPermissionId = typeof WPAY_DASHBOARD_VIEW;

export { WPAY_LEGACY_FULL_ACCESS };

function isGlobalAdminPermission(permission: string): boolean {
  return permission === 'admin.full_access' || permission === '*';
}

export function hasWpayDashboardPermission(
  permissions: readonly string[],
  required: WpayDashboardPermissionId,
): boolean {
  if (permissions.some(isGlobalAdminPermission)) {
    return true;
  }

  if (permissions.includes(WPAY_LEGACY_FULL_ACCESS)) {
    return true;
  }

  return permissions.includes(required);
}
