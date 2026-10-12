import {
  hasInsuranceAdminPermission,
  INSURANCE_ADMIN_COMPANIES_WRITE,
  INSURANCE_ADMIN_FULL,
  INSURANCE_ADMIN_PAYOUTS_WRITE,
  INSURANCE_ADMIN_VIEW,
} from '../authorization/permissions';

describe('hasInsuranceAdminPermission', () => {
  it('grants everything to global admins and the full insurance permission', () => {
    for (const perms of [['admin.full_access'], ['*'], [INSURANCE_ADMIN_FULL]]) {
      expect(hasInsuranceAdminPermission(perms, INSURANCE_ADMIN_PAYOUTS_WRITE)).toBe(true);
    }
  });

  it('lets any write permission view but not write elsewhere', () => {
    expect(hasInsuranceAdminPermission([INSURANCE_ADMIN_PAYOUTS_WRITE], INSURANCE_ADMIN_VIEW)).toBe(true);
    expect(hasInsuranceAdminPermission([INSURANCE_ADMIN_PAYOUTS_WRITE], INSURANCE_ADMIN_COMPANIES_WRITE)).toBe(false);
  });

  it('denies view-only users writes and unrelated admins everything', () => {
    expect(hasInsuranceAdminPermission([INSURANCE_ADMIN_VIEW], INSURANCE_ADMIN_COMPANIES_WRITE)).toBe(false);
    expect(hasInsuranceAdminPermission(['admin.warmpawz_pay'], INSURANCE_ADMIN_VIEW)).toBe(false);
  });
});
