/** Full Warmpawz Insurance admin access (sidebar permission). */
export const INSURANCE_ADMIN_FULL = 'admin.warmpawz_insurance';

/** Read dashboards, companies, vendor links and payouts. */
export const INSURANCE_ADMIN_VIEW = 'admin.warmpawz_insurance.view';

/** Create / edit insurance companies, vendor links and commission terms. */
export const INSURANCE_ADMIN_COMPANIES_WRITE = 'admin.warmpawz_insurance.companies.write';

/** Payout schedule, reminders and recorded receipts. */
export const INSURANCE_ADMIN_PAYOUTS_WRITE = 'admin.warmpawz_insurance.payouts.write';

export type InsuranceAdminPermissionId =
  | typeof INSURANCE_ADMIN_VIEW
  | typeof INSURANCE_ADMIN_COMPANIES_WRITE
  | typeof INSURANCE_ADMIN_PAYOUTS_WRITE;

const WRITE_PERMISSIONS: readonly string[] = [
  INSURANCE_ADMIN_COMPANIES_WRITE,
  INSURANCE_ADMIN_PAYOUTS_WRITE,
];

function isGlobalAdminPermission(permission: string): boolean {
  return permission === 'admin.full_access' || permission === '*';
}

export function hasInsuranceAdminPermission(
  permissions: readonly string[],
  required: InsuranceAdminPermissionId,
): boolean {
  if (permissions.some(isGlobalAdminPermission)) return true;
  if (permissions.includes(INSURANCE_ADMIN_FULL)) return true;
  if (permissions.includes(required)) return true;
  return required === INSURANCE_ADMIN_VIEW && permissions.some((p) => WRITE_PERMISSIONS.includes(p));
}
