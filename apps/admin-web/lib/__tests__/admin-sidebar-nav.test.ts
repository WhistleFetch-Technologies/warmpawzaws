import { getAdminPortalNavItems } from '@warmpawz/shared-types';
import { hrefForAdminSidebarView } from '../admin-sidebar-nav';

describe('admin sidebar Warmpawz Pay and Appointments landing', () => {
  it('maps Warmpawz Pay sidebar view to the dashboard, not catalogue', () => {
    expect(hrefForAdminSidebarView('warmpawz-pay-catalogue')).toBe('/warmpawz-pay');
  });

  it('maps Warmpawz Appointments sidebar view to the dashboard, not catalogue', () => {
    expect(hrefForAdminSidebarView('warmpawz-appointments-catalogue')).toBe(
      '/warmpawz-appointments',
    );
  });

  it('does not store a catalogue routeHint for either sidebar item', () => {
    const pay = getAdminPortalNavItems().find((item) => item.id === 'warmpawz-pay-catalogue');
    const appointments = getAdminPortalNavItems().find(
      (item) => item.id === 'warmpawz-appointments-catalogue',
    );

    expect(pay?.routeHint).toBe('/warmpawz-pay');
    expect(appointments?.routeHint).toBe('/warmpawz-appointments');
    expect(pay?.routeHint).not.toContain('/catalogue');
    expect(appointments?.routeHint).not.toContain('/catalogue');
  });
});
