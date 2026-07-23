import { WPAY_LEGACY_FULL_ACCESS } from '../../catalogue/authorization/permissions';

export const WPAY_MERCHANTS_VIEW = 'admin.warmpawz_pay.merchants.view';

export type WpayMerchantsPermissionId = typeof WPAY_MERCHANTS_VIEW;

export { WPAY_LEGACY_FULL_ACCESS };

function isGlobalAdminPermission(permission: string): boolean {
  return permission === 'admin.full_access' || permission === '*';
}

export function hasWpayMerchantsPermission(
  permissions: readonly string[],
  required: WpayMerchantsPermissionId,
): boolean {
  if (permissions.some(isGlobalAdminPermission)) {
    return true;
  }

  if (permissions.includes(WPAY_LEGACY_FULL_ACCESS)) {
    return true;
  }

  if (permissions.includes('admin.warmpawz_pay.catalogue.view')) {
    return true;
  }

  return permissions.includes(required);
}
