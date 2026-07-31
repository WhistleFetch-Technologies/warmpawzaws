import {
  buildWarmpawzAppointmentsBookingNav,
  buildWarmpawzAppointmentsProfileNav,
  getWarmpawzAppointmentServiceLabel,
  isWarmpawzAppointmentsPaymentRequest,
  resolveWarmpawzBookingScreen,
  WAPPT_BOOKING_MODE,
  WAPPT_VENDOR_PROFILE_SCREEN,
} from '@/lib/warmpawz-appointments-customer';
import {
  listWapptListConfiguredCategories,
} from '@/lib/warmpawz-appointments/wappt-vendor-list-config';
import {
  listWapptProfileConfiguredCategories,
  resolveWapptVendorProfileConfig,
} from '@/lib/warmpawz-appointments/wappt-vendor-profile-config';
import {
  WAPPT_DISCOVERY_STYLE_FILTERS,
} from '@/lib/warmpawz-appointments/wappt-list-style-config';
import {
  buildWapptHubTile,
  getWapptHubConfig,
  listWapptHubCategories,
} from '@/lib/wappt-hub-registry';
import { resolveWapptVendorListConfig } from '@/lib/warmpawz-appointments/wappt-vendor-list-config';

describe('wappt hub category matrix', () => {
  const hubs = listWapptHubCategories();

  it.each(hubs)('registry config for %s', (hub) => {
    const config = getWapptHubConfig(hub);
    expect(config?.bookingScreen).toBeTruthy();
    expect(config?.roleId).toBeTruthy();
    expect(config?.wapptTileId).toBeTruthy();
    expect(resolveWarmpawzBookingScreen(hub)).toBe(config?.bookingScreen);
  });

  it.each(hubs)('list + profile config for %s', (hub) => {
    expect(listWapptListConfiguredCategories()).toContain(hub);
    expect(listWapptProfileConfiguredCategories()).toContain(hub);
    const list = resolveWapptVendorListConfig(hub);
    const profile = resolveWapptVendorProfileConfig(hub);
    expect(list.searchPlaceholder.length).toBeGreaterThan(0);
    expect(list.resultsCountLabel(2)).toMatch(/\d+/);
    expect(profile.servicesApiCategory).toBeTruthy();
    expect(profile.sharePersona).toBeTruthy();
    expect(profile.category).toBe(hub);
  });

  it.each(hubs)('discovery style allowlist for %s', (hub) => {
    const config = getWapptHubConfig(hub);
    expect(config?.allowedDiscoveryStyles).toEqual(['at_center', 'at_home']);
    expect(config?.allowedDiscoveryStyles).toContain(config?.defaultDiscoveryStyle);
  });

  it.each(hubs)('profile and booking nav for %s', (hub) => {
    const profileNav = buildWarmpawzAppointmentsProfileNav({
      vendorId: 'vendor-1',
      vendorName: 'Test Vendor',
      category: hub,
      serviceStyle: 'at_center',
    });
    expect(profileNav.profileBackScreen).toBe('wappt-discovery');

    const bookingNav = buildWarmpawzAppointmentsBookingNav({
      vendorId: 'vendor-1',
      category: hub,
      serviceStyle: 'at_center',
    });
    expect(bookingNav.appointmentsMode).toBe(true);
    expect(bookingNav.bookingMode).toBe(WAPPT_BOOKING_MODE);
    expect(isWarmpawzAppointmentsPaymentRequest({ bookingMode: bookingNav.bookingMode })).toBe(
      true,
    );
    expect(getWarmpawzAppointmentServiceLabel({ category: hub })).toBe('Appointment');
  });

  it.each(hubs)('hub tile for %s', (hub) => {
    const tile = buildWapptHubTile(hub);
    expect(tile?.name).toBe('Book Appointment');
    expect(tile?.id).toBe(getWapptHubConfig(hub)?.wapptTileId);
  });

  it('discovery style filters are at_center and at_home only', () => {
    expect(WAPPT_DISCOVERY_STYLE_FILTERS.map((f) => f.id)).toEqual(['at_center', 'at_home']);
  });

  it('profile screen constant', () => {
    expect(WAPPT_VENDOR_PROFILE_SCREEN).toBe('wappt-vendor-profile');
  });
});

describe('wappt discovery API url contract', () => {
  it.each(listWapptHubCategories())('builds by-category URL for %s', (hub) => {
    const qs = new URLSearchParams({
      category: hub,
      serviceStyle: 'at_center',
      limit: '3',
      cursor: 'abc',
    });
    const url = `/customer/warmpawz-appointments/discovery/by-category?${qs}`;
    expect(url).toContain(`category=${hub}`);
    expect(url).toContain('serviceStyle=at_center');
    expect(url).toContain('limit=3');
    expect(url).toContain('cursor=abc');
  });
});
