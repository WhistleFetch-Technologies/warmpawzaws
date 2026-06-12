import {
  BANNER_VENDOR_BOOKING_NAV_SCREENS,
  collectBannerServiceTypeResolverScreens,
  CUSTOMER_HOME_HANDLED_BANNER_NAV_SCREENS,
} from '../banner-nav-screens';

describe('banner nav screen coverage', () => {
  it('every service_type resolver screen is handled in customer home', () => {
    const resolverScreens = collectBannerServiceTypeResolverScreens();
    expect(resolverScreens.length).toBeGreaterThan(0);
    for (const screen of resolverScreens) {
      expect(CUSTOMER_HOME_HANDLED_BANNER_NAV_SCREENS.has(screen)).toBe(true);
    }
  });

  it('every vendor/booking resolver screen is handled in customer home', () => {
    for (const screen of BANNER_VENDOR_BOOKING_NAV_SCREENS) {
      expect(CUSTOMER_HOME_HANDLED_BANNER_NAV_SCREENS.has(screen)).toBe(true);
    }
  });

  it('includes style-specific grooming and training screens', () => {
    expect(CUSTOMER_HOME_HANDLED_BANNER_NAV_SCREENS.has('grooming_home')).toBe(true);
    expect(CUSTOMER_HOME_HANDLED_BANNER_NAV_SCREENS.has('grooming_center')).toBe(true);
    expect(CUSTOMER_HOME_HANDLED_BANNER_NAV_SCREENS.has('training_home')).toBe(true);
    expect(CUSTOMER_HOME_HANDLED_BANNER_NAV_SCREENS.has('training_center')).toBe(true);
  });
});
