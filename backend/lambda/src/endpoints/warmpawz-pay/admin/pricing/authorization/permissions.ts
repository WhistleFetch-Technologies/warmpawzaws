import { WPAY_LEGACY_FULL_ACCESS } from '../../catalogue/authorization/permissions';

export const WPAY_PRICING_VIEW = 'admin.warmpawz_pay.pricing.view';
export const WPAY_PRICING_WRITE = 'admin.warmpawz_pay.pricing.write';

export type WpayPricingViewPermission = typeof WPAY_PRICING_VIEW;
export type WpayPricingWritePermission = typeof WPAY_PRICING_WRITE;
export type WpayPricingPermissionId = WpayPricingViewPermission | WpayPricingWritePermission;

export { WPAY_LEGACY_FULL_ACCESS };

function isGlobalAdminPermission(permission: string): boolean {
  return permission === 'admin.full_access' || permission === '*';
}

export function hasWpayPricingViewPermission(permissions: readonly string[]): boolean {
  if (permissions.some(isGlobalAdminPermission)) {
    return true;
  }
  if (permissions.includes(WPAY_LEGACY_FULL_ACCESS)) {
    return true;
  }
  if (permissions.includes('admin.warmpawz_pay')) {
    return true;
  }
  return permissions.includes(WPAY_PRICING_VIEW);
}

export function hasWpayPricingWritePermission(permissions: readonly string[]): boolean {
  if (permissions.some(isGlobalAdminPermission)) {
    return true;
  }
  if (permissions.includes(WPAY_LEGACY_FULL_ACCESS)) {
    return true;
  }
  if (permissions.includes('admin.warmpawz_pay')) {
    return true;
  }
  return permissions.includes(WPAY_PRICING_WRITE);
}

export function hasWpayPricingPermission(
  permissions: readonly string[],
  required: WpayPricingPermissionId,
): boolean {
  if (required === WPAY_PRICING_VIEW) {
    return hasWpayPricingViewPermission(permissions);
  }
  return hasWpayPricingWritePermission(permissions);
}
