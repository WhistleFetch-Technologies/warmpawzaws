import { hasWpayDashboardPermission, WPAY_DASHBOARD_VIEW } from '../authorization/permissions';
import { WPAY_LEGACY_FULL_ACCESS } from '../../catalogue/authorization/permissions';

describe('hasWpayDashboardPermission', () => {
  it('grants admin.full_access', () => {
    expect(hasWpayDashboardPermission(['admin.full_access'], WPAY_DASHBOARD_VIEW)).toBe(true);
  });

  it('grants legacy admin.warmpawz_pay', () => {
    expect(hasWpayDashboardPermission([WPAY_LEGACY_FULL_ACCESS], WPAY_DASHBOARD_VIEW)).toBe(true);
  });

  it('grants granular dashboard view permission', () => {
    expect(hasWpayDashboardPermission([WPAY_DASHBOARD_VIEW], WPAY_DASHBOARD_VIEW)).toBe(true);
  });

  it('denies unrelated permissions', () => {
    expect(hasWpayDashboardPermission(['admin.vendors'], WPAY_DASHBOARD_VIEW)).toBe(false);
  });
});
