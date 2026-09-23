import { WPAY_LEGACY_FULL_ACCESS } from '../../catalogue/authorization/permissions';

/** Mark Warmpawz Pay vendor payouts settled (offline transfer). */
export const WPAY_PAYMENTS_SETTLE = 'admin.warmpawz_pay.payments.settle';

export type WpayPaymentsSettlePermissionId = typeof WPAY_PAYMENTS_SETTLE;

export { WPAY_LEGACY_FULL_ACCESS };

function isGlobalAdminPermission(permission: string): boolean {
  return permission === 'admin.full_access' || permission === '*';
}

export function hasWpayPaymentsSettlePermission(
  permissions: readonly string[],
  required: WpayPaymentsSettlePermissionId = WPAY_PAYMENTS_SETTLE,
): boolean {
  if (permissions.some(isGlobalAdminPermission)) {
    return true;
  }
  if (permissions.includes(WPAY_LEGACY_FULL_ACCESS)) {
    return true;
  }
  return permissions.includes(required);
}
